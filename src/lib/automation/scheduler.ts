import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const FIRST_CONTACT_DELAY_MINUTES = 10;
const FIRST_CONTACT_TEMPLATE_KEY = "first_contact";

/**
 * Agenda o primeiro contato automático de um lead novo. Idempotente: o
 * índice único parcial `automation_jobs_lead_type_active_unique_idx`
 * (lead_id, type) where status in ('pending','processing') garante que
 * chamar isso duas vezes para o mesmo lead não cria dois jobs — a segunda
 * chamada é ignorada silenciosamente (unique_violation tratado abaixo).
 *
 * `supabase` é injetável (default: client admin real) só para permitir
 * testar a lógica com um fake em memória — nunca é passado explicitamente
 * em código de produção.
 */
export async function scheduleFirstContact(
  leadId: string,
  supabase: AdminClient = createAdminClient(),
) {
  const { data: template } = await supabase
    .from("message_templates")
    .select("id")
    .eq("key", FIRST_CONTACT_TEMPLATE_KEY)
    .eq("is_active", true)
    .maybeSingle();

  const scheduledFor = new Date(Date.now() + FIRST_CONTACT_DELAY_MINUTES * 60_000);

  const { error } = await supabase.from("automation_jobs").insert({
    lead_id: leadId,
    type: "first_contact",
    status: "pending",
    scheduled_for: scheduledFor.toISOString(),
    template_id: template?.id ?? null,
  });

  if (error) {
    // Índice único parcial (lead_id, type) where status in
    // ('pending','processing') — já existe um job ativo para esse lead,
    // nada a fazer.
    if (error.code === "23505") return;
    throw error;
  }

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "lead_recebido",
    title: "Contato agendado",
    description: `Primeiro contato agendado para ${scheduledFor.toLocaleString("pt-BR")}`,
  });
}

/**
 * Cancela jobs pendentes/em processamento de um lead (ex: o lead respondeu
 * antes do envio automático, ou o atendente já fez contato manual).
 */
export async function cancelPendingAutomation(
  leadId: string,
  reason: string,
  supabase: AdminClient = createAdminClient(),
) {
  const { data: canceledJobs, error } = await supabase
    .from("automation_jobs")
    .update({ status: "canceled", processed_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .in("status", ["pending", "processing"])
    .select("id");

  if (error) throw error;

  if (canceledJobs && canceledJobs.length > 0) {
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      type: "automacao_cancelada",
      title: "Automação cancelada",
      description: reason,
    });
  }
}
