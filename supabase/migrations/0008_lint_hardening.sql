-- Correções apontadas pelo linter de segurança/performance do Supabase
-- depois de aplicar as migrations 0001-0007 num projeto real:
--
--   1. `set_updated_at()` sem `search_path` fixo — vulnerável a search_path
--      hijacking (alguém criar um objeto com o mesmo nome num schema antes
--      no search_path). Baixo risco aqui (função trivial, sem chamadas a
--      objetos ambíguos), mas é a correção padrão recomendada.
--   2. Policies de RLS chamando `auth.role()`/`auth.uid()` direto —
--      Postgres reavalia a função uma vez POR LINHA. Envolver em
--      `(select ...)` faz o planner tratar como InitPlan (avalia uma vez
--      por query). Mesmo comportamento, mais rápido em tabelas grandes.
--
-- Não muda nenhuma regra de acesso — só a forma como é avaliada.

alter function public.set_updated_at() set search_path = public;

-- users
drop policy "authenticated read users" on public.users;
create policy "authenticated read users" on public.users
  for select using ((select auth.role()) = 'authenticated');

drop policy "user updates own profile" on public.users;
create policy "user updates own profile" on public.users
  for update using ((select auth.uid()) = id);

-- campaigns
drop policy "authenticated all campaigns" on public.campaigns;
create policy "authenticated all campaigns" on public.campaigns
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- leads
drop policy "authenticated all leads" on public.leads;
create policy "authenticated all leads" on public.leads
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- lead_activities
drop policy "authenticated all lead_activities" on public.lead_activities;
create policy "authenticated all lead_activities" on public.lead_activities
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- conversations
drop policy "authenticated all conversations" on public.conversations;
create policy "authenticated all conversations" on public.conversations
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- messages
drop policy "authenticated all messages" on public.messages;
create policy "authenticated all messages" on public.messages
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- automation_jobs
drop policy "authenticated all automation_jobs" on public.automation_jobs;
create policy "authenticated all automation_jobs" on public.automation_jobs
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- message_templates
drop policy "authenticated all message_templates" on public.message_templates;
create policy "authenticated all message_templates" on public.message_templates
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- settings
drop policy "authenticated all settings" on public.settings;
create policy "authenticated all settings" on public.settings
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- integration_logs
drop policy "authenticated read integration_logs" on public.integration_logs;
create policy "authenticated read integration_logs" on public.integration_logs
  for select using ((select auth.role()) = 'authenticated');

-- lead_submissions
drop policy "authenticated read lead_submissions" on public.lead_submissions;
create policy "authenticated read lead_submissions" on public.lead_submissions
  for select using ((select auth.role()) = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- Índices de cobertura para as foreign keys apontadas pelo linter de
-- performance (evita seq scan em cascatas de delete/update e em joins).
-- ─────────────────────────────────────────────────────────────

create index if not exists automation_jobs_template_id_idx on public.automation_jobs (template_id);
create index if not exists integration_logs_lead_id_idx on public.integration_logs (lead_id);
create index if not exists lead_activities_actor_id_idx on public.lead_activities (actor_id);
create index if not exists leads_owner_id_idx on public.leads (owner_id);
create index if not exists messages_sent_by_idx on public.messages (sent_by);
create index if not exists messages_template_id_idx on public.messages (template_id);
