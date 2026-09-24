import "server-only";
import { toWhatsAppPhone } from "@/lib/phone";

/**
 * Cliente mínimo para a WhatsApp Cloud API (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/
 *
 * IMPORTANTE: fora da janela de 24h de atendimento, o WhatsApp só permite
 * enviar mensagens usando um Message Template aprovado pela Meta — texto
 * livre é rejeitado. A primeira mensagem de contato do lead precisa ser
 * cadastrada e aprovada como template (ver WHATSAPP_FIRST_CONTACT_TEMPLATE_NAME)
 * antes de ir para produção.
 */

// Confira a versão estável atual em https://developers.facebook.com/docs/graph-api/changelog
// antes de ir para produção — versões antigas são desativadas periodicamente pela Meta.
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";

function getBaseUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado");
  }
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

function getHeaders() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN não configurado");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface WhatsAppSendResult {
  ok: boolean;
  waMessageId?: string;
  error?: string;
}

/** Envia texto livre — só funciona dentro da janela de 24h de atendimento. */
export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(getBaseUrl(), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toWhatsAppPhone(to),
        type: "text",
        text: { body },
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      return { ok: false, error: json?.error?.message ?? "Erro desconhecido da WhatsApp API" };
    }

    return { ok: true, waMessageId: json?.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro de rede" };
  }
}

/** Envia mensagem via Message Template aprovado — necessário fora da janela de 24h. */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[],
): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(getBaseUrl(), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toWhatsAppPhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: bodyParameters.length
            ? [
                {
                  type: "body",
                  parameters: bodyParameters.map((text) => ({ type: "text", text })),
                },
              ]
            : undefined,
        },
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      return { ok: false, error: json?.error?.message ?? "Erro desconhecido da WhatsApp API" };
    }

    return { ok: true, waMessageId: json?.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro de rede" };
  }
}
