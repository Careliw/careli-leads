-- Careli Leads CRM — hardening de automação e observabilidade
--
-- Objetivos desta migration:
--   1. Tornar automation_jobs seguro para concorrência (dois workers rodando
--      ao mesmo tempo não podem processar o mesmo job duas vezes).
--   2. Impedir agendamento duplicado do mesmo tipo de automação para o
--      mesmo lead enquanto já houver um job ativo.
--   3. Reestruturar integration_logs para o formato de observabilidade
--      (provider/direction/event_type/external_id/status/...).
--   4. Restringir leitura de raw_payload (dado bruto do Meta) a apenas
--      service_role — usuários autenticados no app não veem esse campo.

-- ─────────────────────────────────────────────────────────────
-- automation_jobs: colunas de lock (status "processing" já foi
-- adicionado ao enum na migration anterior, 0002)
-- ─────────────────────────────────────────────────────────────

-- "executed_at" passa a se chamar "processed_at" (mesmo significado:
-- quando o job terminou de ser processado, com sucesso ou não).
alter table public.automation_jobs rename column executed_at to processed_at;

alter table public.automation_jobs
  add column if not exists locked_at timestamptz;

comment on column public.automation_jobs.locked_at is
  'Marcado quando um worker reivindica o job (status=processing). Usado para detectar locks travados por worker que morreu no meio da execução.';

-- Evita dois jobs ativos do mesmo tipo para o mesmo lead (ex: dois eventos
-- de webhook chegando quase ao mesmo tempo não podem gerar dois jobs de
-- "first_contact" pendentes/em processamento simultaneamente).
create unique index if not exists automation_jobs_lead_type_active_unique_idx
  on public.automation_jobs (lead_id, type)
  where status in ('pending', 'processing');

drop index if exists public.automation_jobs_pending_idx;
create index automation_jobs_due_idx
  on public.automation_jobs (scheduled_for)
  where status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- claim_due_automation_jobs: reivindicação atômica de jobs vencidos
--
-- Usa "FOR UPDATE SKIP LOCKED" para que, se dois workers chamarem esta
-- função ao mesmo tempo, cada um pegue um conjunto disjunto de jobs — o
-- segundo worker nunca vê uma linha que o primeiro já travou. Também
-- reivindica jobs "processing" cujo lock está velho (worker anterior
-- provavelmente caiu no meio da execução) para não travar o job para
-- sempre.
-- ─────────────────────────────────────────────────────────────

create or replace function public.claim_due_automation_jobs(
  p_limit int default 25,
  p_stale_lock_minutes int default 5
)
returns setof public.automation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.automation_jobs
  set status = 'processing',
      locked_at = now(),
      attempts = attempts + 1
  where id in (
    select id
    from public.automation_jobs
    where scheduled_for <= now()
      and (
        status = 'pending'
        or (status = 'processing' and locked_at < now() - make_interval(mins => p_stale_lock_minutes))
      )
    order by scheduled_for
    limit p_limit
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_due_automation_jobs(int, int) from public, anon, authenticated;
grant execute on function public.claim_due_automation_jobs(int, int) to service_role;

-- ─────────────────────────────────────────────────────────────
-- lead_activities: chave de deduplicação opcional
--
-- Usada quando uma atividade é gerada a partir de um evento externo com id
-- próprio (ex: mensagem do WhatsApp, leadgen do Meta) — inserir com
-- "on conflict (dedupe_key) do nothing" garante que reentregas do mesmo
-- evento não dupliquem a timeline.
-- ─────────────────────────────────────────────────────────────

alter table public.lead_activities
  add column if not exists dedupe_key text;

create unique index if not exists lead_activities_dedupe_key_unique_idx
  on public.lead_activities (dedupe_key)
  where dedupe_key is not null;

-- ─────────────────────────────────────────────────────────────
-- messages: idempotência por wa_message_id
-- ─────────────────────────────────────────────────────────────

create unique index if not exists messages_wa_message_id_unique_idx
  on public.messages (wa_message_id)
  where wa_message_id is not null;

-- ─────────────────────────────────────────────────────────────
-- integration_logs: reestruturação para observabilidade
-- ─────────────────────────────────────────────────────────────

alter table public.integration_logs rename column source to provider;

alter table public.integration_logs
  add column if not exists direction text,
  add column if not exists event_type text,
  add column if not exists external_id text,
  add column if not exists status text not null default 'info',
  add column if not exists error_message text,
  add column if not exists request_id text,
  add column if not exists duration_ms integer;

comment on column public.integration_logs.provider is 'meta_webhook | meta_graph_api | whatsapp_webhook | whatsapp_api | automation';
comment on column public.integration_logs.direction is 'inbound | outbound (nulo quando não se aplica, ex: job interno)';
comment on column public.integration_logs.event_type is 'ex: leadgen, message_received, first_contact_sent, cron_tick';
comment on column public.integration_logs.external_id is 'id do evento na plataforma externa (leadgen_id, wa_message_id...) para correlação/dedupe';
comment on column public.integration_logs.status is 'success | error | skipped | info | warning (livre, sem enum para não travar evolução)';
comment on column public.integration_logs.error_message is 'mensagem de erro já sanitizada — nunca deve conter tokens/segredos';
comment on column public.integration_logs.context is 'metadados adicionais em JSON — nunca deve conter tokens/segredos, ver lib/observability/sanitize.ts';

create index if not exists integration_logs_external_id_idx
  on public.integration_logs (provider, external_id)
  where external_id is not null;

create index if not exists integration_logs_event_type_idx
  on public.integration_logs (event_type);

-- ─────────────────────────────────────────────────────────────
-- Segurança: raw_payload (dado bruto do Meta) só é legível pelo backend.
-- service_role sempre ignora RLS/privilégios de coluna; aqui só
-- restringimos explicitamente o que "authenticated" (usuários do app)
-- pode enxergar.
-- ─────────────────────────────────────────────────────────────

revoke select (raw_payload) on public.leads from authenticated;

-- context de integration_logs pode conter payloads/detalhes técnicos —
-- mantém leitura restrita ao backend, mesmo que a linha em si seja visível.
revoke select (context) on public.integration_logs from authenticated;
