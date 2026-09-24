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

export function LeadStageSelect({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={stage}
      disabled={isPending}
      onValueChange={(value) => {
        startTransition(async () => {
          await changeLeadStageAction(leadId, value as LeadStage);
          toast.success(`Status atualizado para "${LEAD_STAGE_LABELS[value as LeadStage]}"`);
        });
      }}
    >
      <SelectTrigger className="w-full sm:w-56">
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
