import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AutomationJobStatus, MessageTemplate } from "@/types/domain";

export interface AutomationJobRow {
  id: string;
  lead_id: string;
  status: AutomationJobStatus;
  scheduled_for: string;
  processed_at: string | null;
  attempts: number;
  last_error: string | null;
  lead: { id: string; full_name: string; phone: string } | null;
}

export async function getAutomationJobs(): Promise<AutomationJobRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_jobs")
    .select(
      "id, lead_id, status, scheduled_for, processed_at, attempts, last_error, lead:leads ( id, full_name, phone )",
    )
    .order("scheduled_for", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as AutomationJobRow[];
}

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as MessageTemplate[];
}
