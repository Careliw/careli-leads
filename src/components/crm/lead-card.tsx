import Link from "next/link";
import { Building2, MapPin, Megaphone, Phone } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "@/components/crm/stage-badge";
import { formatRelativeDate } from "@/lib/format";
import type { Lead } from "@/types/domain";

export function LeadCard({ lead, dragHandleProps }: { lead: Lead; dragHandleProps?: React.HTMLAttributes<HTMLDivElement> }) {
  return (
    <Link href={`/leads/${lead.id}`} className="block">
      <Card className="gap-3 py-3 transition-colors hover:border-primary/40 hover:shadow-sm" {...dragHandleProps}>
        <CardContent className="space-y-2 px-3">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{lead.full_name}</p>
            <StageBadge stage={lead.stage} className="shrink-0 text-[10px] px-1.5 py-0" />
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
            {lead.campaign?.name ? (
              <div className="flex items-center gap-1.5">
                <Megaphone className="size-3 shrink-0" />
                <span className="truncate">{lead.campaign.name}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              {formatRelativeDate(lead.created_at)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
