import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadActivity, LeadStage, LeadSubmission } from "@/types/domain";

const LEAD_SELECT = `
  id, owner_id, full_name, phone, email, company_name, city, segment,
  already_on_google, relation_to_company, origin, meta_leadgen_id,
  campaign_id, stage, notes, contacted_at, responded_at, closed_at,
  lost_reason, created_at, updated_at,
  campaign:campaigns ( id, name, adset_name, ad_name )
`;

export async function getLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Lead[];
}

export async function getPipelineLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .neq("stage", "perdido")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Lead[];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Lead | null;
}

export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, lead_id, actor_id, type, title, description, metadata, dedupe_key, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as LeadActivity[];
}

/**
 * Histórico de submissões do lead (cada preenchimento de formulário).
 * `raw_payload` não é selecionado aqui de propósito — a coluna é
 * restrita a service_role a nível de privilégio de coluna no banco (ver
 * migration 0004), então nem tentamos ler no client autenticado.
 */
export async function getLeadSubmissions(leadId: string): Promise<LeadSubmission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_submissions")
    .select(
      "id, lead_id, external_lead_id, source, platform, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, form_id, form_name, submitted_at, created_at",
    )
    .eq("lead_id", leadId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as LeadSubmission[];
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  const supabase = await createClient();

  const timestampPatch: Record<string, string> = {};
  if (stage === "fechado") timestampPatch.closed_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("leads")
    .update({ stage, ...timestampPatch })
    .eq("id", leadId);
  if (updateError) throw updateError;

  const { error: activityError } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "status_alterado",
    title: "Status alterado",
    description: `Lead movido para "${stage}"`,
  });
  if (activityError) throw activityError;
}

export async function addLeadNote(leadId: string, note: string) {
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("leads")
    .update({ notes: note })
    .eq("id", leadId);
  if (updateError) throw updateError;

  const { error: activityError } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "observacao_adicionada",
    title: "Observação adicionada",
    description: note,
  });
  if (activityError) throw activityError;
}

export interface DashboardStats {
  leadsToday: number;
  leadsWeek: number;
  leadsMonth: number;
  leadsContacted: number;
  leadsResponded: number;
  diagnosticsDone: number;
  proposalsSent: number;
  clientsClosed: number;
  funnel: Record<LeadStage, number>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("stage, created_at, contacted_at, responded_at");

  if (error) throw error;

  const rows = leads ?? [];

  const funnel: Record<LeadStage, number> = {
    novo_lead: 0,
    contato_enviado: 0,
    respondeu: 0,
    diagnostico: 0,
    interessado: 0,
    proposta: 0,
    fechado: 0,
    perdido: 0,
  };

  let leadsToday = 0;
  let leadsWeek = 0;
  let leadsMonth = 0;
  let leadsContacted = 0;
  let leadsResponded = 0;

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    if (createdAt >= startOfDay) leadsToday++;
    if (createdAt >= startOfWeek) leadsWeek++;
    if (createdAt >= startOfMonth) leadsMonth++;
    if (row.contacted_at) leadsContacted++;
    if (row.responded_at) leadsResponded++;
    const stage = row.stage as LeadStage;
    if (stage in funnel) funnel[stage]++;
  }

  return {
    leadsToday,
    leadsWeek,
    leadsMonth,
    leadsContacted,
    leadsResponded,
    diagnosticsDone: funnel.diagnostico + funnel.interessado + funnel.proposta + funnel.fechado,
    proposalsSent: funnel.proposta + funnel.fechado,
    clientsClosed: funnel.fechado,
    funnel,
  };
}
