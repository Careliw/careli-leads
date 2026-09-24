import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { TopBar } from "@/components/crm/top-bar";
import { StageBadge } from "@/components/crm/stage-badge";
import { LeadStageSelect } from "@/components/crm/lead-stage-select";
import { LeadNoteForm } from "@/components/crm/lead-note-form";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getLeadActivities, getLeadById, getLeadSubmissions } from "@/lib/data/leads";
import { formatDateTime, whatsappLink } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const { id } = await params;
  const [lead, activities, submissions] = await Promise.all([
    getLeadById(id),
    getLeadActivities(id),
    getLeadSubmissions(id),
  ]);

  if (!lead) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title={lead.full_name} description={lead.company_name ?? undefined} />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <StageBadge stage={lead.stage} />
            <span className="text-xs text-muted-foreground">
              Entrou em {formatDateTime(lead.created_at)}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <LeadStageSelect leadId={lead.id} stage={lead.stage} />
            <Button asChild className="gap-2">
              <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                Abrir WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Dados do lead</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Nome completo" value={lead.full_name} />
                <Field label="WhatsApp" value={lead.phone} />
                <Field label="E-mail" value={lead.email} />
                <Field label="Empresa" value={lead.company_name} />
                <Field label="Cidade" value={lead.city} />
                <Field label="Segmento" value={lead.segment} />
                <Field
                  label="Já aparece no Google?"
                  value={
                    lead.already_on_google === null
                      ? null
                      : lead.already_on_google
                        ? "Sim"
                        : "Não"
                  }
                />
                <Field label="Relação com a empresa" value={lead.relation_to_company} />
                <Separator />
                <Field label="Origem" value={lead.origin} />
                <Field label="Campanha" value={lead.campaign?.name} />
                <Field label="Conjunto de anúncios" value={lead.campaign?.adset_name} />
                <Field label="Anúncio" value={lead.campaign?.ad_name} />
              </CardContent>
            </Card>

            {submissions.length > 1 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Submissões ({submissions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {submission.campaign_name ?? submission.source}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(submission.submitted_at)}
                        </span>
                      </div>
                      {submission.ad_name ? (
                        <p className="text-xs text-muted-foreground">{submission.ad_name}</p>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Observações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.notes ? (
                  <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                    {lead.notes}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma observação ainda.</p>
                )}
                <LeadNoteForm leadId={lead.id} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Linha do tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline activities={activities} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
