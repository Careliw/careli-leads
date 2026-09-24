-- Careli Leads CRM — schema inicial
-- Convenção: todas as tabelas de negócio têm RLS habilitado.
-- Modelo é single-tenant hoje (um gestor de tráfego), mas já preparado
-- para múltiplos usuários via auth.uid() em vez de service-role fixo.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

create type lead_stage as enum (
  'novo_lead',
  'contato_enviado',
  'respondeu',
  'diagnostico',
  'interessado',
  'proposta',
  'fechado',
  'perdido'
);

create type activity_type as enum (
  'lead_recebido',
  'mensagem_enviada',
  'resposta_recebida',
  'status_alterado',
  'observacao_adicionada',
  'diagnostico_feito',
  'proposta_enviada',
  'venda',
  'perda',
  'automacao_cancelada',
  'automacao_erro'
);

create type message_direction as enum ('outbound', 'inbound');

create type message_status as enum (
  'queued',
  'sent',
  'delivered',
  'read',
  'failed'
);

create type automation_job_status as enum (
  'pending',
  'sent',
  'canceled',
  'failed'
);

create type automation_job_type as enum (
  'first_contact'
);

-- ─────────────────────────────────────────────────────────────
-- users (perfil do usuário autenticado, 1:1 com auth.users)
-- ─────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text not null default 'gestor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- campaigns (campanhas do Meta Ads, para exibir origem/campanha/anúncio)
-- ─────────────────────────────────────────────────────────────

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  meta_campaign_id text unique,
  meta_adset_id text,
  meta_ad_id text,
  name text not null,
  adset_name text,
  ad_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- leads
-- ─────────────────────────────────────────────────────────────

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users (id) on delete set null,

  full_name text not null,
  phone text not null,
  phone_normalized text generated always as (
    regexp_replace(phone, '\D', '', 'g')
  ) stored,
  email text,

  company_name text,
  city text,
  segment text,
  already_on_google boolean,
  relation_to_company text,

  origin text not null default 'meta_lead_ads',
  meta_leadgen_id text unique,
  campaign_id uuid references public.campaigns (id) on delete set null,

  stage lead_stage not null default 'novo_lead',
  notes text,

  contacted_at timestamptz,
  responded_at timestamptz,
  closed_at timestamptz,
  lost_reason text,

  raw_payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index leads_phone_normalized_unique_idx
  on public.leads (phone_normalized)
  where phone_normalized is not null and phone_normalized <> '';

create index leads_stage_idx on public.leads (stage);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_campaign_id_idx on public.leads (campaign_id);

-- ─────────────────────────────────────────────────────────────
-- lead_activities (timeline)
-- ─────────────────────────────────────────────────────────────

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  type activity_type not null,
  title text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index lead_activities_lead_id_idx on public.lead_activities (lead_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- conversations + messages (WhatsApp)
-- ─────────────────────────────────────────────────────────────

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  wa_phone_number text not null,
  is_automation_active boolean not null default true,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  direction message_direction not null,
  status message_status not null default 'queued',
  body text not null,
  template_id uuid,
  wa_message_id text,
  error_message text,
  sent_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);
create index messages_lead_id_idx on public.messages (lead_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- automation_jobs
-- ─────────────────────────────────────────────────────────────

create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  type automation_job_type not null default 'first_contact',
  status automation_job_status not null default 'pending',
  scheduled_for timestamptz not null,
  executed_at timestamptz,
  template_id uuid,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_jobs_pending_idx
  on public.automation_jobs (scheduled_for)
  where status = 'pending';

create index automation_jobs_lead_id_idx on public.automation_jobs (lead_id);

-- ─────────────────────────────────────────────────────────────
-- message_templates
-- ─────────────────────────────────────────────────────────────

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  body text not null,
  variables text[] not null default '{}',
  wa_template_name text,
  wa_template_language text default 'pt_BR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.messages
  add constraint messages_template_id_fkey
  foreign key (template_id) references public.message_templates (id) on delete set null;

alter table public.automation_jobs
  add constraint automation_jobs_template_id_fkey
  foreign key (template_id) references public.message_templates (id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- settings (chave/valor simples, por usuário ou global quando user_id nulo)
-- ─────────────────────────────────────────────────────────────

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- ─────────────────────────────────────────────────────────────
-- integration_logs (erros/observabilidade de Meta e WhatsApp)
-- ─────────────────────────────────────────────────────────────

create table public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- 'meta_webhook' | 'meta_graph_api' | 'whatsapp_webhook' | 'whatsapp_api' | 'automation'
  level text not null default 'info', -- 'info' | 'warning' | 'error'
  message text not null,
  context jsonb,
  lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);

create index integration_logs_created_at_idx on public.integration_logs (created_at desc);
create index integration_logs_source_idx on public.integration_logs (source);

-- ─────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.automation_jobs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.automation_jobs enable row level security;
alter table public.message_templates enable row level security;
alter table public.settings enable row level security;
alter table public.integration_logs enable row level security;

-- Todo usuário autenticado (equipe interna) pode ler/gerenciar os dados.
-- Webhooks e jobs usam a service role (bypassa RLS) a partir do backend.

create policy "authenticated read users" on public.users
  for select using (auth.role() = 'authenticated');
create policy "user updates own profile" on public.users
  for update using (auth.uid() = id);

create policy "authenticated all campaigns" on public.campaigns
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all leads" on public.leads
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all lead_activities" on public.lead_activities
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all conversations" on public.conversations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all messages" on public.messages
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all automation_jobs" on public.automation_jobs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all message_templates" on public.message_templates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all settings" on public.settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated read integration_logs" on public.integration_logs
  for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- Seed: template padrão de primeiro contato
-- ─────────────────────────────────────────────────────────────

insert into public.message_templates (key, name, body, variables)
values (
  'first_contact',
  'Primeiro contato (10 min)',
  'Oi, {{nome}}! Aqui é o Wesley. Vi que você solicitou o diagnóstico da presença da {{empresa}} no Google. Recebi seus dados e vou analisar como a empresa está aparecendo nas buscas. Assim que eu identificar os principais pontos, te mando por aqui.',
  array['nome', 'empresa', 'cidade', 'segmento']
);
