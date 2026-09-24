import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeContext, sanitizeText } from "@/lib/observability/sanitize";

export type LogProvider =
  | "meta_webhook"
  | "meta_graph_api"
  | "whatsapp_webhook"
  | "whatsapp_api"
  | "automation";

export type LogStatus = "success" | "error" | "skipped" | "info" | "warning";

export interface LogIntegrationEventInput {
  provider: LogProvider;
  status: LogStatus;
  message: string;
  eventType?: string;
  direction?: "inbound" | "outbound";
  externalId?: string;
  errorMessage?: string;
  leadId?: string;
  requestId?: string;
  durationMs?: number;
  context?: Record<string, unknown>;
}

const STATUS_TO_LEVEL: Record<LogStatus, "info" | "warning" | "error"> = {
  success: "info",
  info: "info",
  skipped: "warning",
  warning: "warning",
  error: "error",
};

/**
 * Ponto único de escrita em `integration_logs`. Sempre sanitiza mensagem e
 * contexto antes de gravar — nunca deve chegar token/segredo no banco.
 */
export async function logIntegrationEvent(input: LogIntegrationEventInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("integration_logs").insert({
      provider: input.provider,
      status: input.status,
      level: STATUS_TO_LEVEL[input.status],
      message: sanitizeText(input.message),
      event_type: input.eventType ?? null,
      direction: input.direction ?? null,
      external_id: input.externalId ?? null,
      error_message: input.errorMessage ? sanitizeText(input.errorMessage) : null,
      lead_id: input.leadId ?? null,
      request_id: input.requestId ?? null,
      duration_ms: input.durationMs ?? null,
      context: input.context ? sanitizeContext(input.context) : null,
    });

    if (error) {
      console.error("[integration_logs] falha ao gravar log:", error.message);
    }
  } catch (error) {
    // Nunca deixamos uma falha de log (incluindo client mal configurado)
    // derrubar o fluxo principal (webhook, automação).
    console.error(
      "[integration_logs] falha inesperada ao gravar log:",
      error instanceof Error ? error.message : error,
    );
  }
}
