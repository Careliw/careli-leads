import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processPendingAutomationJobs } from "@/lib/automation/service";
import { logIntegrationEvent } from "@/lib/observability/log";
import { sanitizeText } from "@/lib/observability/sanitize";

export const runtime = "nodejs";

/**
 * Disparador do worker de automação. Hoje é chamado pelo Supabase pg_cron
 * (via pg_net) a cada minuto — ver supabase/migrations/0005_*.sql. A
 * lógica de negócio propriamente dita vive em
 * `processPendingAutomationJobs` (lib/automation/service.ts) e não sabe
 * nem se importa com quem a chamou; trocar o disparador (Netlify
 * Scheduled Function, QStash, chamada manual...) não exige tocar nela.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const results = await processPendingAutomationJobs();

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logIntegrationEvent({
      provider: "automation",
      status: "error",
      message: "Falha não tratada no worker de automação",
      errorMessage: message,
      eventType: "cron_tick",
    });
    // Mensagem sanitizada só para diagnóstico rápido — nunca expõe segredos
    // (ver lib/observability/sanitize.ts), mas ainda não é para consumo
    // público; considerar remover o campo `error` daqui antes de anunciar
    // o endpoint publicamente.
    return NextResponse.json({ error: sanitizeText(message) }, { status: 500 });
  }
}

// Aceita GET também para facilitar testes manuais/curl em desenvolvimento.
export async function GET(request: NextRequest) {
  return POST(request);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.AUTOMATION_CRON_SECRET;
  if (!secret) return false;

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
