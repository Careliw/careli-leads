import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todas as rotas /api/** têm sua própria autenticação (assinatura de
  // webhook, secret de cron) — nunca devem passar pelo proxy de sessão do
  // Supabase Auth, ou uma chamada sem cookie de sessão (ex: pg_cron, Meta,
  // WhatsApp) seria redirecionada para /login em vez de cair no handler.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
