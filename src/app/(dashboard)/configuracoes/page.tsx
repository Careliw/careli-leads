import { CheckCircle2, XCircle } from "lucide-react";

import { TopBar } from "@/components/crm/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

function StatusRow({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {ok ? (
        <Badge variant="outline" className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-3" />
          Configurado
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 border-red-500/20 bg-red-500/10 text-red-600">
          <XCircle className="size-3" />
          Pendente
        </Badge>
      )}
    </div>
  );
}

export default async function ConfiguracoesPage() {
  let userEmail: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  }

  const integrations = [
    {
      label: "Supabase",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      hint: "Banco de dados, autenticação e realtime",
    },
    {
      label: "Meta Lead Ads / Graph API",
      ok: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_WEBHOOK_VERIFY_TOKEN),
      hint: "Recebimento automático de leads das campanhas",
    },
    {
      label: "WhatsApp Business Platform",
      ok: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      hint: "Envio e recebimento de mensagens",
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Configurações" description="Perfil e status das integrações" />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">E-mail: </span>
              {userEmail ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {integrations.map((integration) => (
              <StatusRow key={integration.label} {...integration} />
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              As credenciais são configuradas por variáveis de ambiente no servidor (Netlify) e
              nunca ficam expostas no navegador.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
