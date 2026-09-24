"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addLeadNoteAction } from "@/app/(dashboard)/leads/[id]/actions";

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await addLeadNoteAction(leadId, formData);
          formRef.current?.reset();
          toast.success("Observação adicionada");
        });
      }}
      className="space-y-2"
    >
      <Textarea
        name="note"
        placeholder="Adicionar observação sobre este lead..."
        className="min-h-20"
        required
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar observação"}
        </Button>
      </div>
    </form>
  );
}
