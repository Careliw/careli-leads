"use server";

import { revalidatePath } from "next/cache";
import { addLeadNote, updateLeadStage } from "@/lib/data/leads";
import type { LeadStage } from "@/types/domain";

export async function changeLeadStageAction(leadId: string, stage: LeadStage) {
  await updateLeadStage(leadId, stage);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
}

export async function addLeadNoteAction(leadId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  await addLeadNote(leadId, note);
  revalidatePath(`/leads/${leadId}`);
}
