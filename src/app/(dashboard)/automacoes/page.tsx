import { Clock, Zap } from "lucide-react";

import { TopBar } from "@/components/crm/top-bar";
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { getAutomationJobs, getMessageTemplates } from "@/lib/data/automation";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  processing: "Processando",
  sent: "Enviado",
  canceled: "Cancelado",
  failed: "Falhou",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  canceled: "bg-muted text-muted-foreground border-transparent",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default async function AutomacoesPage() {
  const configured = isSupabaseConfigured();
  const [jobs, templates] = configured
    ? await Promise.all([getAutomationJobs(), getMessageTemplates()])
    : [[], []];

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Automações"
        description="Primeiro contato automático 10 minutos após a entrada do lead"
      />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!configured ? <SupabaseSetupNotice /> : null}

        <Card className="border-primary/30 bg-primary/[0.04]">
          <CardContent className="flex items-start gap-3 py-4">
            <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Como funciona</p>
              <p className="mt-1 text-muted-foreground">
                Ao entrar, o lead recebe uma tarefa agendada para 10 minutos depois. Se ele ainda
                não tiver sido contatado quando a tarefa rodar, enviamos a primeira mensagem pelo
                WhatsApp automaticamente. Se o lead responder antes disso, a automação é cancelada
                e o atendimento passa a ser manual.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Templates de mensagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{template.name}</p>
                    <div className="flex gap-1">
                      {template.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-[10px]">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {template.body}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Fila de automação</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Clock className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum job de automação ainda.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Agendado para</TableHead>
                    <TableHead>Executado em</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">
                        {job.lead?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(job.scheduled_for)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.processed_at ? formatDateTime(job.processed_at) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{job.attempts}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLE[job.status]}>
                          {STATUS_LABEL[job.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
