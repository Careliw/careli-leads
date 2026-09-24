export const LEAD_STAGES = [
  "novo_lead",
  "contato_enviado",
  "respondeu",
  "diagnostico",
  "interessado",
  "proposta",
  "fechado",
  "perdido",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  novo_lead: "Novo lead",
  contato_enviado: "Contato enviado",
  respondeu: "Respondeu",
  diagnostico: "Diagnóstico",
  interessado: "Interessado",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const PIPELINE_STAGES: LeadStage[] = [
  "novo_lead",
  "contato_enviado",
  "respondeu",
  "diagnostico",
  "interessado",
  "proposta",
  "fechado",
  "perdido",
];

export const FUNNEL_STAGES: LeadStage[] = [
  "novo_lead",
  "contato_enviado",
  "respondeu",
  "diagnostico",
  "interessado",
  "proposta",
  "fechado",
];

export const ACTIVITY_TYPES = [
  "lead_recebido",
  "nova_submissao",
  "mensagem_enviada",
  "resposta_recebida",
  "status_alterado",
  "observacao_adicionada",
  "diagnostico_feito",
  "proposta_enviada",
  "venda",
  "perda",
  "automacao_cancelada",
  "automacao_erro",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Campaign {
  id: string;
  name: string;
  adset_name: string | null;
  ad_name: string | null;
}

export interface Lead {
  id: string;
  owner_id: string | null;
  full_name: string;
  phone: string;
  phone_normalized?: string;
  email: string | null;
  company_name: string | null;
  city: string | null;
  segment: string | null;
  already_on_google: boolean | null;
  relation_to_company: string | null;
  origin: string;
  meta_leadgen_id: string | null;
  campaign_id: string | null;
  stage: LeadStage;
  notes: string | null;
  contacted_at: string | null;
  responded_at: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  campaign?: Campaign | null;
}

/**
 * Uma entrada individual de formulário (Meta Lead Ads hoje, outras
 * plataformas no futuro). Vários registros podem apontar para o mesmo
 * `lead_id` — é assim que preservamos a atribuição (campanha/anúncio) de
 * cada nova submissão de um contato já existente, sem duplicar o contato.
 */
export interface LeadSubmission {
  id: string;
  lead_id: string;
  external_lead_id: string | null;
  source: string;
  platform: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  form_id: string | null;
  form_name: string | null;
  submitted_at: string;
  created_at: string;
  /** Só presente quando lido com o client admin (service_role). */
  raw_payload?: Record<string, unknown> | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  actor_id: string | null;
  type: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  dedupe_key: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  variables: string[];
  wa_template_name: string | null;
  wa_template_language: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const AUTOMATION_JOB_STATUSES = [
  "pending",
  "processing",
  "sent",
  "canceled",
  "failed",
] as const;

export type AutomationJobStatus = (typeof AUTOMATION_JOB_STATUSES)[number];

export interface AutomationJob {
  id: string;
  lead_id: string;
  type: "first_contact";
  status: AutomationJobStatus;
  scheduled_for: string;
  locked_at: string | null;
  processed_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  lead_id: string;
  wa_phone_number: string;
  is_automation_active: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageDirection = "outbound" | "inbound";
export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface MessageRecord {
  id: string;
  conversation_id: string;
  lead_id: string;
  direction: MessageDirection;
  status: MessageStatus;
  body: string;
  template_id: string | null;
  wa_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

/**
 * Espelha `integration_logs`. `context` só vem preenchido quando lido com
 * o client admin (privilégio de coluna restrito para `authenticated`).
 */
export interface IntegrationLog {
  id: string;
  provider: string;
  direction: "inbound" | "outbound" | null;
  event_type: string | null;
  external_id: string | null;
  status: string;
  level: "info" | "warning" | "error";
  message: string;
  error_message: string | null;
  request_id: string | null;
  duration_ms: number | null;
  lead_id: string | null;
  created_at: string;
  context?: Record<string, unknown> | null;
}
