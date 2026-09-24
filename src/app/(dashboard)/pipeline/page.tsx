import { TopBar } from "@/components/crm/top-bar";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { SupabaseSetupNotice } from "@/components/crm/supabase-setup-notice";
import { getPipelineLeads } from "@/lib/data/leads";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function PipelinePage() {
  const configured = isSupabaseConfigured();
  const leads = configured ? await getPipelineLeads() : [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Pipeline" description="Arraste os cards entre as colunas" />
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        {!configured ? <SupabaseSetupNotice /> : null}
        <div className="flex-1 overflow-hidden">
          <KanbanBoard leads={leads} />
        </div>
      </div>
    </div>
  );
}
