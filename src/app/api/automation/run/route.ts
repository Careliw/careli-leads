import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processPendingAutomationJobs } from "@/lib/automation/service";

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

  const results = await processPendingAutomationJobs();

  return NextResponse.json({
    processed: results.length,
    results,
  });
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
