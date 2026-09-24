"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import { Building2, MapPin, Phone } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/format";
import { LeadStageSelect } from "@/components/crm/lead-stage-select";
import { changeLeadStageAction } from "@/app/(dashboard)/leads/[id]/actions";
import {
  PIPELINE_STAGES,
  LEAD_STAGE_LABELS,
  type Lead,
  type LeadStage,
} from "@/types/domain";

export function KanbanBoard({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const columns = useMemo(() => {
    const grouped = new Map<LeadStage, Lead[]>();
    for (const stage of PIPELINE_STAGES) grouped.set(stage, []);
    for (const lead of leads) grouped.get(lead.stage)?.push(lead);
    return grouped;
  }, [leads]);

  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function moveLead(leadId: string, newStage: LeadStage) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    const previousStage = lead.stage;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));

    startTransition(async () => {
      try {
        await changeLeadStageAction(leadId, newStage);
        toast.success(`${lead.full_name} → ${LEAD_STAGE_LABELS[newStage]}`);
      } catch {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, stage: previousStage } : l)),
        );
        toast.error("Não foi possível mover o lead. Tente novamente.");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    moveLead(String(active.id), String(over.id) as LeadStage);
  }

  return (
    <>
      {/* Desktop/tablet grande: kanban horizontal tradicional com drag-and-drop. */}
      <div className="hidden h-full md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-3 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn key={stage} stage={stage} leads={columns.get(stage) ?? []} />
            ))}
          </div>
          <DragOverlay>{activeLead ? <KanbanCard lead={activeLead} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>

      {/* Mobile: sem drag-and-drop (pouco confiável em touch) — tabs por
          estágio + lista, e cada card tem um seletor de estágio direto. */}
      <div className="md:hidden">
        <MobilePipeline columns={columns} onMove={moveLead} />
      </div>
    </>
  );
}

function MobilePipeline({
  columns,
  onMove,
}: {
  columns: Map<LeadStage, Lead[]>;
  onMove: (leadId: string, stage: LeadStage) => void;
}) {
  const [selectedStage, setSelectedStage] = useState<LeadStage>(PIPELINE_STAGES[0]);
  const leads = columns.get(selectedStage) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        aria-label="Estágio do pipeline"
        className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-3"
      >
        {PIPELINE_STAGES.map((stage) => {
          const isActive = stage === selectedStage;
          const count = columns.get(stage)?.length ?? 0;
          return (
            <button
              key={stage}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedStage(stage)}
              className={`flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {LEAD_STAGE_LABELS[stage]}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  isActive ? "bg-primary-foreground/20" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pb-4">
        {leads.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum lead em &quot;{LEAD_STAGE_LABELS[selectedStage]}&quot;.
          </p>
        ) : (
          leads.map((lead) => (
            <MobilePipelineCard key={lead.id} lead={lead} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}

function MobilePipelineCard({
  lead,
  onMove,
}: {
  lead: Lead;
  onMove: (leadId: string, stage: LeadStage) => void;
}) {
  return (
    <Card className="gap-2 py-3">
      <CardContent className="space-y-2.5 px-3.5">
        <Link href={`/leads/${lead.id}`} className="block space-y-1.5">
          <p className="truncate text-sm font-semibold">{lead.full_name}</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            {lead.company_name ? (
              <div className="flex items-center gap-1.5">
                <Building2 className="size-3 shrink-0" />
                <span className="truncate">{lead.company_name}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{formatRelativeDate(lead.created_at)}</p>
        </Link>
        <LeadStageSelect
          leadId={lead.id}
          stage={lead.stage}
          triggerClassName="h-9 w-full text-sm"
          onChanged={(newStage) => onMove(lead.id, newStage)}
        />
      </CardContent>
    </Card>
  );
}

function KanbanColumn({ stage, leads }: { stage: LeadStage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-sm font-semibold">{LEAD_STAGE_LABELS[stage]}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Vazio</p>
        ) : null}
      </div>
    </div>
  );
}

function KanbanCard({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging && !overlay ? "opacity-40" : undefined}
    >
      <Link href={`/leads/${lead.id}`} onClick={(e) => isDragging && e.preventDefault()}>
        <Card className="gap-2 py-3 shadow-none transition-shadow hover:shadow-sm">
          <CardContent className="space-y-1.5 px-3">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold">{lead.full_name}</p>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {lead.company_name ? (
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3 shrink-0" />
                  <span className="truncate">{lead.company_name}</span>
                </div>
              ) : null}
              {lead.city ? (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{lead.city}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Phone className="size-3 shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatRelativeDate(lead.created_at)}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
