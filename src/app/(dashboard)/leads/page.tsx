import Link from "next/link";
import { Users } from "lucide-react";

import { TopBar } from "@/components/crm/top-bar";
import { StageBadge } from "@/components/crm/stage-badge";
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeDate } from "@/lib/format";
import { getLeads } from "@/lib/data/leads";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function LeadsPage() {
  const configured = isSupabaseConfigured();
  const leads = configured ? await getLeads() : [];

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Leads" description={`${leads.length} lead(s) no total`} />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!configured ? <SupabaseSetupNotice /> : null}

        {configured && leads.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {leads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`}>
                  <Card className="gap-2 py-3">
                    <CardContent className="space-y-1.5 px-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{lead.full_name}</p>
                        <StageBadge stage={lead.stage} className="shrink-0 text-[10px] px-1.5 py-0" />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.company_name ?? "—"} · {lead.city ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="block">
                          {lead.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.company_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.city ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.origin}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.campaign?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeDate(lead.created_at)}
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={lead.stage} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="font-medium">Nenhum lead ainda</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Assim que a integração com Meta Lead Ads estiver ativa, os leads das suas campanhas
          aparecerão aqui automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}
