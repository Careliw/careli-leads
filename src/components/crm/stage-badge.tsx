import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/types/domain";

const STAGE_STYLES: Record<LeadStage, string> = {
  novo_lead: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  contato_enviado: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  respondeu: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  diagnostico: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  interessado: "bg-primary/10 text-primary border-primary/20",
  proposta: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  fechado: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  perdido: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function StageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STAGE_STYLES[stage], "font-medium", className)}>
      {LEAD_STAGE_LABELS[stage]}
    </Badge>
  );
}
