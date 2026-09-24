import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/meta/verify-signature";
import { cancelPendingAutomation } from "@/lib/automation/scheduler";
import { normalizePhoneDigits } from "@/lib/phone";
import { logIntegrationEvent } from "@/lib/observability/log";

export const runtime = "nodejs";

/**
 * Verificação do webhook (mesmo mecanismo hub.challenge do Meta).
 *
 * Endpoint já preparado e idempotente (dedupe por wa_message_id) mas ainda
 * NÃO conectado a nenhum número real do WhatsApp — ver README, seção
 * "Próximos passos para WhatsApp".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Mensagens recebidas. Payload de referência:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    await logIntegrationEvent({
      provider: "whatsapp_webhook",
      status: "error",
      message: "Assinatura inválida no webhook do WhatsApp",
      eventType: "invalid_signature",
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const incomingMessages = extractIncomingMessages(payload);

  for (const message of incomingMessages) {
    const startedAt = Date.now();
    try {
      await processIncomingMessage(message);
      await logIntegrationEvent({
        provider: "whatsapp_webhook",
        status: "success",
        message: "Mensagem recebida processada",
        eventType: "message_received",
        direction: "inbound",
        externalId: message.waMessageId,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      await logIntegrationEvent({
        provider: "whatsapp_webhook",
        status: "error",
        message: "Erro ao processar mensagem recebida do WhatsApp",
        eventType: "message_received",
        direction: "inbound",
        externalId: message.waMessageId,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return NextResponse.json({ received: true, count: incomingMessages.length });
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

interface IncomingMessage {
  from: string;
  waMessageId: string;
  body: string;
}

function extractIncomingMessages(payload: WhatsAppWebhookPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        messages.push({
          from: message.from,
          waMessageId: message.id,
          body: message.type === "text" ? (message.text?.body ?? "") : `[${message.type}]`,
        });
      }
    }
  }
  return messages;
}

async function processIncomingMessage(incoming: IncomingMessage) {
  const supabase = createAdminClient();
  const phoneNormalized = normalizePhoneDigits(incoming.from);

  const { data: lead } = await supabase
    .from("leads")
    .select("id, stage")
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (!lead) {
    await logIntegrationEvent({
      provider: "whatsapp_webhook",
      status: "skipped",
      message: "Mensagem recebida de número sem lead correspondente",
      eventType: "message_received",
      externalId: incoming.waMessageId,
    });
    return;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .upsert(
      { lead_id: lead.id, wa_phone_number: incoming.from, is_automation_active: false },
      { onConflict: "lead_id" },
    )
    .select("id")
    .single();

  if (conversationError) throw conversationError;

  // Idempotência: wa_message_id tem índice único parcial — reentrega do
  // mesmo evento do WhatsApp cai em unique_violation e é tratada como
  // "já processado", sem duplicar a mensagem nem os efeitos abaixo.
  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    lead_id: lead.id,
    direction: "inbound",
    status: "delivered",
    body: incoming.body,
    wa_message_id: incoming.waMessageId,
  });

  if (messageError) {
    if (messageError.code === "23505") {
      await logIntegrationEvent({
        provider: "whatsapp_webhook",
        status: "skipped",
        message: "Mensagem duplicada ignorada (wa_message_id já registrado)",
        eventType: "message_received",
        externalId: incoming.waMessageId,
        leadId: lead.id,
      });
      return;
    }
    throw messageError;
  }

  const now = new Date().toISOString();
  await supabase
    .from("conversations")
    .update({ last_message_at: now, is_automation_active: false })
    .eq("id", conversation.id);

  const isFirstResponse = lead.stage === "novo_lead" || lead.stage === "contato_enviado";

  await supabase
    .from("leads")
    .update({
      responded_at: now,
      stage: isFirstResponse ? "respondeu" : lead.stage,
    })
    .eq("id", lead.id);

  await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    type: "resposta_recebida",
    title: "Resposta recebida",
    description: incoming.body,
    dedupe_key: `wa_in:${incoming.waMessageId}`,
  });

  if (isFirstResponse) {
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      type: "status_alterado",
      title: "Status alterado",
      description: 'Lead movido para "Respondeu"',
    });
  }

  await cancelPendingAutomation(lead.id, "Lead respondeu antes do envio automático");
}
