import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/cloud-api";
import { renderTemplate } from "@/lib/templates/render";
import { logIntegrationEvent } from "@/lib/observability/log";
import type { Lead, MessageTemplate } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

interface ClaimedJob {
  id: string;
  lead_id: string;
  template_id: string | null;
  attempts: number;
}

export interface ProcessJobResult {
  jobId: string;
  leadId: string;
  outcome: "sent" | "skipped" | "failed";
  detail?: string;
}

/**
 * Ponto único de entrada do worker de automação — a regra de negócio não
 * sabe (nem precisa saber) quem a chamou. Hoje é o Supabase pg_cron via
 * pg_net batendo em POST /api/automation/run a cada minuto (ver migration
 * 0005). Podia ser uma Netlify Scheduled Function, um QStash, ou uma
 * chamada manual — a troca do disparador não exige mudar nada aqui.
 */
export async function processPendingAutomationJobs(
  limit = 25,
  supabase: AdminClient = createAdminClient(),
): Promise<ProcessJobResult[]> {
  // Reivindicação atômica via SELECT ... FOR UPDATE SKIP LOCKED dentro da
  // função do banco: se dois workers chamarem isso ao mesmo tempo, cada um
  // recebe um conjunto disjunto de jobs — nunca o mesmo job duas vezes.
  const { data: claimedJobs, error } = await supabase.rpc("claim_due_automation_jobs", {
    p_limit: limit,
  });

  if (error) {
    await logIntegrationEvent({
      provider: "automation",
      status: "error",
      message: "Falha ao reivindicar automation_jobs",
      errorMessage: error.message,
      eventType: "claim_jobs",
    });
    throw error;
  }

  const results: ProcessJobResult[] = [];
  for (const job of (claimedJobs ?? []) as ClaimedJob[]) {
    results.push(await processClaimedJob(supabase, job));
  }

  return results;
}

async function processClaimedJob(supabase: AdminClient, job: ClaimedJob): Promise<ProcessJobResult> {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", job.lead_id)
    .maybeSingle();

  if (leadError || !lead) {
    await failJob(supabase, job, "Lead não encontrado");
    return { jobId: job.id, leadId: job.lead_id, outcome: "failed", detail: "Lead não encontrado" };
  }

  // Revalida no momento do processamento (não apenas no agendamento):
  // o lead pode ter respondido ou sido contatado manualmente entre o
  // agendamento e agora.
  const skipReason = getSkipReason(lead as Lead);
  if (skipReason) {
    await supabase
      .from("automation_jobs")
      .update({ status: "canceled", processed_at: new Date().toISOString() })
      .eq("id", job.id);
    return { jobId: job.id, leadId: job.lead_id, outcome: "skipped", detail: skipReason };
  }

  const template = await resolveTemplate(supabase, job.template_id);
  if (!template) {
    await failJob(supabase, job, "Template de primeiro contato não encontrado");
    return { jobId: job.id, leadId: job.lead_id, outcome: "failed", detail: "Template não encontrado" };
  }

  const messageBody = renderTemplate(template, lead as Lead);
  const dryRun = isAutomationDryRun();

  const sendResult = dryRun
    ? { ok: true as const, waMessageId: undefined }
    : await sendWhatsAppText(lead.phone, messageBody);

  if (!sendResult.ok) {
    await failJob(supabase, job, sendResult.error ?? "Falha ao enviar mensagem");
    await logIntegrationEvent({
      provider: "automation",
      status: "error",
      message: "Falha ao enviar primeiro contato",
      errorMessage: sendResult.error,
      eventType: "first_contact_send",
      leadId: lead.id,
    });
    return { jobId: job.id, leadId: job.lead_id, outcome: "failed", detail: sendResult.error };
  }

  const conversation = await getOrCreateConversation(supabase, lead.id, lead.phone);
  const now = new Date().toISOString();

  if (dryRun) {
    // AUTOMATION_DRY_RUN=true: NÃO chama a WhatsApp Cloud API de verdade e
    // NÃO grava linha em `messages` (essa tabela representa envios reais).
    // O resto do fluxo (job, estágio do lead, timeline) roda normalmente
    // para validar a automação de ponta a ponta antes do WhatsApp estar
    // conectado.
    await logIntegrationEvent({
      provider: "automation",
      status: "skipped",
      message: "[DRY-RUN] Primeiro contato seria enviado, mas AUTOMATION_DRY_RUN=true — WhatsApp não foi chamado",
      eventType: "first_contact_dry_run",
      leadId: lead.id,
      context: { messageBody },
    });
  } else {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      lead_id: lead.id,
      direction: "outbound",
      status: "sent",
      body: messageBody,
      template_id: template.id,
      wa_message_id: sendResult.waMessageId,
    });

    await logIntegrationEvent({
      provider: "automation",
      status: "success",
      message: "Primeiro contato enviado",
      eventType: "first_contact_send",
      externalId: sendResult.waMessageId,
      leadId: lead.id,
    });
  }

  await supabase.from("conversations").update({ last_message_at: now }).eq("id", conversation.id);
  await supabase.from("leads").update({ stage: "contato_enviado", contacted_at: now }).eq("id", lead.id);

  await supabase.from("lead_activities").insert([
    {
      lead_id: lead.id,
      type: "mensagem_enviada",
      title: dryRun ? "[TESTE] Primeiro contato simulado (dry-run)" : "Mensagem de primeiro contato enviada",
      description: dryRun
        ? `Modo de teste — nenhuma mensagem real foi enviada. Conteúdo que seria enviado:\n${messageBody}`
        : messageBody,
      dedupe_key: sendResult.waMessageId ? `wa_out:${sendResult.waMessageId}` : null,
    },
    {
      lead_id: lead.id,
      type: "status_alterado",
      title: "Status alterado",
      description: 'Lead movido para "Contato enviado" automaticamente',
    },
  ]);

  await supabase
    .from("automation_jobs")
    .update({ status: "sent", processed_at: now })
    .eq("id", job.id);

  return { jobId: job.id, leadId: job.lead_id, outcome: "sent", detail: dryRun ? "dry-run" : undefined };
}

/**
 * Modo seguro para validar o worker de ponta a ponta antes do WhatsApp
 * estar conectado: reivindica o job, roda toda a validação, mas nunca
 * chama a WhatsApp Cloud API nem grava uma mensagem como enviada de
 * verdade. Ativar com `AUTOMATION_DRY_RUN=true`.
 */
function isAutomationDryRun(): boolean {
  return process.env.AUTOMATION_DRY_RUN === "true";
}

/** Motivo pelo qual um job não deve mais ser executado, ou `null` se deve seguir. */
export function getSkipReason(lead: Lead): string | null {
  if (lead.responded_at) return "Lead já respondeu";
  if (lead.contacted_at) return "Lead já foi contatado";
  if (lead.stage !== "novo_lead") return `Lead não está mais em "novo_lead" (está em "${lead.stage}")`;
  return null;
}

async function resolveTemplate(
  supabase: AdminClient,
  templateId: string | null,
): Promise<MessageTemplate | null> {
  const query = templateId
    ? supabase.from("message_templates").select("*").eq("id", templateId).maybeSingle()
    : supabase.from("message_templates").select("*").eq("key", "first_contact").maybeSingle();

  const { data } = await query;
  return (data as MessageTemplate | null) ?? null;
}

async function getOrCreateConversation(supabase: AdminClient, leadId: string, phone: string) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ lead_id: leadId, wa_phone_number: phone })
    .select("id")
    .single();

  if (error) {
    // Corrida: outra execução criou a conversa nesse meio tempo.
    if (error.code === "23505") {
      const { data: raceConversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("lead_id", leadId)
        .single();
      if (raceConversation) return raceConversation;
    }
    throw error;
  }
  return created;
}

async function failJob(supabase: AdminClient, job: ClaimedJob, message: string) {
  const isFinalAttempt = job.attempts >= 3;

  const patch: Record<string, unknown> = {
    status: isFinalAttempt ? "failed" : "pending",
    last_error: message,
  };

  if (isFinalAttempt) {
    patch.processed_at = new Date().toISOString();
  } else {
    // Ainda vai tentar de novo: empurra o agendamento alguns minutos.
    patch.scheduled_for = new Date(Date.now() + 5 * 60_000).toISOString();
  }

  await supabase.from("automation_jobs").update(patch).eq("id", job.id);
}
