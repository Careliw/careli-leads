import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FUNNEL_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/types/domain";

export function FunnelChart({ funnel }: { funnel: Record<LeadStage, number> }) {
  const max = Math.max(1, ...FUNNEL_STAGES.map((stage) => funnel[stage]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {FUNNEL_STAGES.map((stage, index) => {
          const value = funnel[stage];
          const width = Math.max(4, (value / max) * 100);
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-muted-foreground sm:w-32">
                {LEAD_STAGE_LABELS[stage]}
              </span>
              <div className="h-6 flex-1 rounded-md bg-muted">
                <div
                  className="flex h-6 items-center justify-end rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition-all"
                  style={{
                    width: `${width}%`,
                    opacity: 0.55 + (index / FUNNEL_STAGES.length) * 0.45,
                  }}
                >
                  {value > 0 ? value : ""}
                </div>
              </div>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {value}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
