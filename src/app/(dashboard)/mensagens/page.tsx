import Link from "next/link";
import { MessageCircle, Zap, ZapOff } from "lucide-react";

import { TopBar } from "@/components/crm/top-bar";
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/format";
import { getConversations } from "@/lib/data/messages";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function MensagensPage() {
  const configured = isSupabaseConfigured();
  const conversations = configured ? await getConversations() : [];

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Mensagens" description="Conversas de WhatsApp com os leads" />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!configured ? <SupabaseSetupNotice /> : null}

        {conversations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <MessageCircle className="size-8 text-muted-foreground" />
              <p className="font-medium">Nenhuma conversa ainda</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                As conversas aparecem aqui assim que o primeiro contato automático for enviado ou
                o lead responder pelo WhatsApp.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Link key={conversation.id} href={`/leads/${conversation.lead_id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <MessageCircle className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {conversation.lead?.full_name ?? "Lead"}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {conversation.last_message_at
                            ? formatRelativeDate(conversation.last_message_at)
                            : ""}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {conversation.last_message?.body ?? "Sem mensagens ainda"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        conversation.is_automation_active
                          ? "gap-1 border-primary/20 bg-primary/10 text-primary"
                          : "gap-1 text-muted-foreground"
                      }
                    >
                      {conversation.is_automation_active ? (
                        <Zap className="size-3" />
                      ) : (
                        <ZapOff className="size-3" />
                      )}
                      {conversation.is_automation_active ? "Automático" : "Manual"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
