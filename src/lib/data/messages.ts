import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ConversationRow {
  id: string;
  lead_id: string;
  is_automation_active: boolean;
  last_message_at: string | null;
  lead: { id: string; full_name: string; phone: string; stage: string } | null;
  last_message: { body: string; direction: "outbound" | "inbound" } | null;
}

export async function getConversations(): Promise<ConversationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, lead_id, is_automation_active, last_message_at, lead:leads ( id, full_name, phone, stage )",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw error;

  const conversations = (data ?? []) as unknown as ConversationRow[];

  const withLastMessage = await Promise.all(
    conversations.map(async (conversation) => {
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("body, direction")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return { ...conversation, last_message: lastMessage ?? null };
    }),
  );

  return withLastMessage;
}

export async function getMessagesByLead(leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, lead_id, direction, status, body, wa_message_id, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
