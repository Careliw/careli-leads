import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneDigits } from "@/lib/phone";
import { scheduleFirstContact } from "@/lib/automation/scheduler";
import { logIntegrationEvent } from "@/lib/observability/log";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface LeadSubmissionInput {
  fullName: string;
  phone: string;
  email?: string | null;
  companyName?: string | null;
  city?: string | null;
  segment?: string | null;
  alreadyOnGoogle?: boolean | null;
  relationToCompany?: string | null;
  origin: string;
  platform: string;
  /** Id do evento na plataforma de origem (ex: leadgen_id do Meta). */
  externalLeadId?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  formId?: string | null;
  formName?: string | null;
  submittedAt?: string;
  rawPayload?: unknown;
}

export interface UpsertLeadResult {
  leadId: string;
  isNewLead: boolean;
  /** true quando esse exato evento externo já tinha sido processado antes (webhook reentregue). */
  isDuplicateSubmission: boolean;
}

interface ExistingLeadRow {
  id: string;
  email: string | null;
  company_name: string | null;
  city: string | null;
  segment: string | null;
  already_on_google: boolean | null;
  relation_to_company: string | null;
}

/**
 * Decide quais campos do lead já existente devem ser preenchidos com os
 * dados da nova submissão. Só completa o que está vazio — nunca sobrescreve
 * um valor que o gestor (ou uma submissão anterior) já preencheu. Função
 * pura para ser testável sem banco.
 */
export function buildMissingFieldsPatch(
  existing: ExistingLeadRow,
  incoming: LeadSubmissionInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (!existing.email && incoming.email) patch.email = incoming.email;
  if (!existing.company_name && incoming.companyName) patch.company_name = incoming.companyName;
  if (!existing.city && incoming.city) patch.city = incoming.city;
  if (!existing.segment && incoming.segment) patch.segment = incoming.segment;
  if (existing.already_on_google === null && incoming.alreadyOnGoogle != null) {
    patch.already_on_google = incoming.alreadyOnGoogle;
  }
  if (!existing.relation_to_company && incoming.relationToCompany) {
    patch.relation_to_company = incoming.relationToCompany;
  }

  return patch;
}

const UNIQUE_VIOLATION = "23505";

/**
 * Ponto único de entrada de um lead vindo de qualquer formulário/webhook.
 * Idempotente e seguro para concorrência:
 *
 *  - Reentrega do mesmo evento externo (mesma plataforma + external_lead_id)
 *    é detectada antes de qualquer escrita e não gera nada novo.
 *  - Duas submissões simultâneas do mesmo telefone não geram dois leads: a
 *    segunda IN SERT colide com o índice único de `phone_normalized` e cai
 *    no caminho de "lead já existe".
 */
export async function upsertLeadFromSubmission(
  input: LeadSubmissionInput,
  supabase: AdminClient = createAdminClient(),
): Promise<UpsertLeadResult> {
  const phoneNormalized = normalizePhoneDigits(input.phone);

  if (!phoneNormalized) {
    throw new Error("Lead sem telefone válido — não é possível deduplicar nem prosseguir");
  }

  if (input.externalLeadId) {
    const { data: existingSubmission } = await supabase
      .from("lead_submissions")
      .select("lead_id")
      .eq("platform", input.platform)
      .eq("external_lead_id", input.externalLeadId)
      .maybeSingle();

    if (existingSubmission) {
      return { leadId: existingSubmission.lead_id, isNewLead: false, isDuplicateSubmission: true };
    }
  }

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id, email, company_name, city, segment, already_on_google, relation_to_company")
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (existingLead) {
    return handleExistingLead(supabase, existingLead, input);
  }

  const { data: insertedLead, error: insertError } = await supabase
    .from("leads")
    .insert({
      full_name: input.fullName,
      phone: input.phone,
      email: input.email ?? null,
      company_name: input.companyName ?? null,
      city: input.city ?? null,
      segment: input.segment ?? null,
      already_on_google: input.alreadyOnGoogle ?? null,
      relation_to_company: input.relationToCompany ?? null,
      origin: input.origin,
      meta_leadgen_id: input.platform === "meta" ? input.externalLeadId : null,
      campaign_id: input.campaignId ?? null,
      raw_payload: input.rawPayload ?? null,
    })
    .select(
      "id, email, company_name, city, segment, already_on_google, relation_to_company",
    )
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      // Corrida: outra requisição criou o lead entre o SELECT e o INSERT
      // acima. Trata como "lead já existe" em vez de falhar.
      const { data: raceLead, error: raceError } = await supabase
        .from("leads")
        .select("id, email, company_name, city, segment, already_on_google, relation_to_company")
        .eq("phone_normalized", phoneNormalized)
        .single();

      if (raceError || !raceLead) throw insertError;
      return handleExistingLead(supabase, raceLead, input);
    }
    throw insertError;
  }

  await insertSubmission(supabase, insertedLead.id, input);

  await supabase.from("lead_activities").insert({
    lead_id: insertedLead.id,
    type: "lead_recebido",
    title: "Lead recebido",
    description: buildOriginDescription(input),
    dedupe_key: input.externalLeadId ? `submission:${input.platform}:${input.externalLeadId}` : null,
  });

  await scheduleFirstContact(insertedLead.id, supabase);

  return { leadId: insertedLead.id, isNewLead: true, isDuplicateSubmission: false };
}

async function handleExistingLead(
  supabase: AdminClient,
  existingLead: ExistingLeadRow,
  input: LeadSubmissionInput,
): Promise<UpsertLeadResult> {
  const patch = buildMissingFieldsPatch(existingLead, input);
  if (Object.keys(patch).length > 0) {
    await supabase.from("leads").update(patch).eq("id", existingLead.id);
  }

  const submissionInserted = await insertSubmission(supabase, existingLead.id, input);

  if (submissionInserted) {
    await supabase.from("lead_activities").insert({
      lead_id: existingLead.id,
      type: "nova_submissao",
      title: "Nova submissão recebida",
      description: buildOriginDescription(input),
      dedupe_key: input.externalLeadId
        ? `submission:${input.platform}:${input.externalLeadId}`
        : null,
    });
  } else {
    await logIntegrationEvent({
      provider: "meta_webhook",
      status: "skipped",
      message: "Submissão duplicada ignorada (external_lead_id já registrado)",
      eventType: "duplicate_submission",
      externalId: input.externalLeadId ?? undefined,
      leadId: existingLead.id,
    });
  }

  return {
    leadId: existingLead.id,
    isNewLead: false,
    isDuplicateSubmission: !submissionInserted,
  };
}

/**
 * Insere a submissão via RPC (ver `insert_lead_submission_idempotent` na
 * migration 0004) — necessário porque o índice único é parcial e o
 * query builder do supabase-js não expressa `ON CONFLICT ... WHERE ...`.
 * Retorna `true` quando uma linha nova foi de fato criada.
 */
async function insertSubmission(
  supabase: AdminClient,
  leadId: string,
  input: LeadSubmissionInput,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("insert_lead_submission_idempotent", {
    p_lead_id: leadId,
    p_external_lead_id: input.externalLeadId ?? null,
    p_source: input.origin,
    p_platform: input.platform,
    p_campaign_id: input.campaignId ?? null,
    p_campaign_name: input.campaignName ?? null,
    p_adset_id: input.adsetId ?? null,
    p_adset_name: input.adsetName ?? null,
    p_ad_id: input.adId ?? null,
    p_ad_name: input.adName ?? null,
    p_form_id: input.formId ?? null,
    p_form_name: input.formName ?? null,
    p_submitted_at: input.submittedAt ?? new Date().toISOString(),
    p_raw_payload: input.rawPayload ?? null,
  });

  if (error) throw error;
  return Boolean(data);
}

function buildOriginDescription(input: LeadSubmissionInput): string {
  const parts = [input.campaignName, input.adName].filter(Boolean);
  return parts.length > 0 ? `Origem: ${parts.join(" · ")}` : `Origem: ${input.origin}`;
}
