import {
  Users,
  CalendarDays,
  CalendarRange,
  PhoneOutgoing,
  MessageSquareReply,
  Stethoscope,
  FileText,
  Trophy,
} from "lucide-react";

import { TopBar } from "@/components/crm/top-bar";
import { StatCard } from "@/components/crm/stat-card";
import { FunnelChart } from "@/components/crm/funnel-chart";
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice";
import { getDashboardStats } from "@/lib/data/leads";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function DashboardPage() {
  const configured = isSupabaseConfigured();
  const stats = configured
    ? await getDashboardStats()
    : {
        leadsToday: 0,
        leadsWeek: 0,
        leadsMonth: 0,
        leadsContacted: 0,
        leadsResponded: 0,
        diagnosticsDone: 0,
        proposalsSent: 0,
        clientsClosed: 0,
        funnel: {
          novo_lead: 0,
          contato_enviado: 0,
          respondeu: 0,
          diagnostico: 0,
          interessado: 0,
          proposta: 0,
          fechado: 0,
          perdido: 0,
        },
      };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Dashboard" description="Visão geral dos seus leads e do funil comercial" />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!configured ? <SupabaseSetupNotice /> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Leads hoje" value={stats.leadsToday} icon={CalendarDays} highlight />
          <StatCard label="Leads na semana" value={stats.leadsWeek} icon={CalendarRange} />
          <StatCard label="Leads no mês" value={stats.leadsMonth} icon={Users} />
          <StatCard label="Leads contatados" value={stats.leadsContacted} icon={PhoneOutgoing} />
          <StatCard
            label="Leads que responderam"
            value={stats.leadsResponded}
            icon={MessageSquareReply}
          />
          <StatCard label="Diagnósticos realizados" value={stats.diagnosticsDone} icon={Stethoscope} />
          <StatCard label="Propostas enviadas" value={stats.proposalsSent} icon={FileText} />
          <StatCard label="Clientes fechados" value={stats.clientsClosed} icon={Trophy} highlight />
        </div>

        <FunnelChart funnel={stats.funnel} />
      </div>
    </div>
  );
}
