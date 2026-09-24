"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeLeadStageAction } from "@/app/(dashboard)/leads/[id]/actions";
import { PIPELINE_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/types/domain";

export function LeadStageSelect({
  leadId,
  stage,
  triggerClassName = "w-full sm:w-56",
  onChanged,
}: {
  leadId: string;
  stage: LeadStage;
  triggerClassName?: string;
  onChanged?: (stage: LeadStage) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={stage}
      disabled={isPending}
      onValueChange={(value) => {
        startTransition(async () => {
          await changeLeadStageAction(leadId, value as LeadStage);
          toast.success(`Status atualizado para "${LEAD_STAGE_LABELS[value as LeadStage]}"`);
          onChanged?.(value as LeadStage);
        });
      }}
    >
      {/* onClick impede o Select de disparar o clique do <Link> pai (cards clicáveis). */}
      <SelectTrigger className={triggerClassName} onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PIPELINE_STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            {LEAD_STAGE_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
