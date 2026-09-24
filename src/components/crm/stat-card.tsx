import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && "border-primary/40")}>
      <CardContent className="flex items-start justify-between gap-2 px-3.5 py-3 sm:items-center sm:gap-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs leading-snug font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
        </div>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:size-9",
            highlight && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4 sm:size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
