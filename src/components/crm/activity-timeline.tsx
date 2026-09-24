import {
  UserPlus,
  FilePlus2,
  MessageSquareText,
  MessageSquareReply,
  ArrowRightLeft,
  StickyNote,
  Stethoscope,
  FileText,
  Trophy,
  XCircle,
  Ban,
  AlertTriangle,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { ActivityType, LeadActivity } from "@/types/domain";

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  lead_recebido: UserPlus,
  nova_submissao: FilePlus2,
  mensagem_enviada: MessageSquareText,
  resposta_recebida: MessageSquareReply,
  status_alterado: ArrowRightLeft,
  observacao_adicionada: StickyNote,
  diagnostico_feito: Stethoscope,
  proposta_enviada: FileText,
  venda: Trophy,
  perda: XCircle,
  automacao_cancelada: Ban,
  automacao_erro: AlertTriangle,
  automacao_simulada: FlaskConical,
};

export function ActivityTimeline({ activities }: { activities: LeadActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>;
  }

  return (
    <ol className="space-y-0">
      {activities.map((activity, index) => {
        const Icon = ACTIVITY_ICON[activity.type] ?? StickyNote;
        const isLast = index === activities.length - 1;
        return (
          <li key={activity.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-border" />
            ) : null}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <div className="flex-1 space-y-0.5 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-sm font-medium">{activity.title}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(activity.created_at)}
                </span>
              </div>
              {activity.description ? (
                <p className="text-sm text-muted-foreground">{activity.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
