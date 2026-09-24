import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMetaLead, fieldDataToRecord } from "@/lib/meta/graph-api";
import { verifyMetaSignature } from "@/lib/meta/verify-signature";
import { upsertLeadFromSubmission } from "@/lib/leads/upsert-lead";
import { logIntegrationEvent } from "@/lib/observability/log";

export const runtime = "nodejs";

/**
 * Verificação do webhook, exigida pela Meta ao cadastrar a URL.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 *
 * Endpoint já preparado e idempotente (dedupe por leadgen_id em
 * lead_submissions) mas ainda NÃO conectado a nenhum app real do Meta —
 * ver README, seção "Próximos passos para Meta".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Evento de leadgen. Payload de referência:
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    await logIntegrationEvent({
      provider: "meta_webhook",
      status: "error",
      message: "Assinatura inválida no webhook do Meta",
      eventType: "invalid_signature",
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const leadgenEvents = extractLeadgenEvents(payload);

  for (const event of leadgenEvents) {
    const eventStartedAt = Date.now();
    try {
      await processLeadgenEvent(event.leadgen_id);
      await logIntegrationEvent({
        provider: "meta_webhook",
        status: "success",
        message: "Evento leadgen processado",
        eventType: "leadgen",
        externalId: event.leadgen_id,
        durationMs: Date.now() - eventStartedAt,
      });
    } catch (error) {
      await logIntegrationEvent({
        provider: "meta_webhook",
        status: "error",
        message: `Erro ao processar leadgen_id ${event.leadgen_id}`,
        eventType: "leadgen",
        externalId: event.leadgen_id,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - eventStartedAt,
      });
    }
  }

  // A Meta espera 200 rapidamente; erros individuais já foram logados acima.
  return NextResponse.json({ received: true, count: leadgenEvents.length, durationMs: Date.now() - startedAt });
}

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: { leadgen_id: string; page_id?: string; form_id?: string; ad_id?: string };
    }>;
  }>;
}

function extractLeadgenEvents(payload: MetaWebhookPayload) {
  const events: { leadgen_id: string }[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "leadgen" && change.value?.leadgen_id) {
        events.push({ leadgen_id: change.value.leadgen_id });
      }
    }
  }
  return events;
}

async function processLeadgenEvent(leadgenId: string) {
  const supabase = createAdminClient();

  const metaLead = await fetchMetaLead(leadgenId);
  const fields = fieldDataToRecord(metaLead.field_data);

  // Os nomes abaixo dependem de como o formulário do Meta Ads foi
  // configurado (rótulos das perguntas). Ajuste conforme o formulário real.
  const fullName = fields.full_name ?? fields.nome ?? "Lead sem nome";
  const phone = fields.phone_number ?? fields.telefone ?? fields.whatsapp ?? "";
  const email = fields.email ?? null;
  const companyName = fields.company_name ?? fields.empresa ?? null;
  const city = fields.city ?? fields.cidade ?? null;

  if (!phone) {
    await logIntegrationEvent({
      provider: "meta_webhook",
      status: "skipped",
      message: "Lead do Meta sem telefone — ignorado",
      eventType: "leadgen",
      externalId: leadgenId,
      context: { fields },
    });
    return;
  }

  let campaignId: string | null = null;
  if (metaLead.campaign_id) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .upsert(
        {
          meta_campaign_id: metaLead.campaign_id,
          meta_adset_id: metaLead.adset_id,
          meta_ad_id: metaLead.ad_id,
          name: metaLead.campaign_name ?? "Campanha sem nome",
          adset_name: metaLead.adset_name,
          ad_name: metaLead.ad_name,
        },
        { onConflict: "meta_campaign_id" },
      )
      .select("id")
      .single();
    campaignId = campaign?.id ?? null;
  }

  const result = await upsertLeadFromSubmission({
    fullName,
    phone,
    email,
    companyName,
    city,
    origin: "meta_lead_ads",
    platform: "meta",
    externalLeadId: metaLead.id,
    campaignId,
    campaignName: metaLead.campaign_name,
    adsetId: metaLead.adset_id,
    adsetName: metaLead.adset_name,
    adId: metaLead.ad_id,
    adName: metaLead.ad_name,
    formId: metaLead.form_id,
    submittedAt: metaLead.created_time,
    rawPayload: metaLead,
  });

  if (result.isDuplicateSubmission) {
    await logIntegrationEvent({
      provider: "meta_webhook",
      status: "skipped",
      message: "Evento leadgen já processado anteriormente (idempotência)",
      eventType: "leadgen",
      externalId: leadgenId,
      leadId: result.leadId,
    });
  }
}
