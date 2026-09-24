-- Careli Leads CRM — disparo do worker de automação via pg_cron + pg_net
--
-- Arquitetura: a REGRA DE NEGÓCIO do worker (processPendingAutomationJobs)
-- vive no app Next.js (src/lib/automation/service.ts), exposta em
-- POST /api/automation/run. Este arquivo só cuida do GATILHO: a cada
-- minuto, o Postgres chama essa rota via HTTP (pg_net). Trocar o gatilho
-- no futuro (Netlify Scheduled Function, QStash, etc.) não exige tocar na
-- lógica de automação — só em quem chama a rota.
--
-- Fica INERTE até ser configurado: sem URL/segredo salvos em
-- private.app_settings, a função de trigger simplesmente não faz nada.
-- Configure depois do deploy na Netlify (ver README, seção "Automações").

-- pg_cron não é relocável (sempre instala no schema "cron"); pg_net
-- convencionalmente vai para "extensions" nos projetos Supabase.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Schema não exposto pela API do PostgREST — guarda configuração operacional
-- (URL do worker e o segredo compartilhado), nunca dados de negócio.
create schema if not exists private;

create table if not exists private.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on private.app_settings from anon, authenticated;
-- Apenas service_role e o dono do schema (usado pela função abaixo) acessam.

create or replace function private.trigger_automation_worker()
returns void
language plpgsql
security definer
set search_path = private, extensions, public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.app_settings where key = 'automation_worker_url';
  select value into v_secret from private.app_settings where key = 'automation_cron_secret';

  if v_url is null or v_secret is null or v_url = '' or v_secret = '' then
    -- Ainda não configurado (nenhum deploy real conectado) — não faz nada.
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function private.trigger_automation_worker() from public, anon, authenticated;

select cron.schedule(
  'process-automation-jobs',
  '* * * * *',
  $$ select private.trigger_automation_worker(); $$
);

comment on table private.app_settings is
  'Configuração operacional (ex: URL do worker de automação e segredo do cron). Nunca guarde aqui dado de negócio — isso fica nas tabelas do schema public.';
