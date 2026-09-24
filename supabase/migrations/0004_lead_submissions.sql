-- Careli Leads CRM — histórico de submissões de lead
--
-- Problema que esta migration resolve: um mesmo contato (identificado
-- principalmente pelo telefone normalizado) pode preencher o formulário
-- mais de uma vez — em campanhas diferentes, anúncios diferentes, datas
-- diferentes. Antes só existia "leads.meta_leadgen_id" (1 valor, unique),
-- então a 2ª submissão do mesmo telefone não tinha onde ser registrada sem
-- sobrescrever a atribuição original ou ser descartada.
--
-- A partir daqui: "leads" continua sendo o contato/pessoa único (uma
-- linha por telefone normalizado). "lead_submissions" guarda cada entrada
-- individual, preservando origem/campanha/anúncio daquela submissão
-- específica, sem duplicar o contato.

create table public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,

  -- Identificador do evento na plataforma de origem (ex: leadgen_id do
  -- Meta). Usado para deduplicar reentregas do mesmo evento de webhook.
  external_lead_id text,

  source text not null default 'meta_lead_ads',
  platform text not null default 'meta',

  campaign_id uuid references public.campaigns (id) on delete set null,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  form_id text,
  form_name text,

  submitted_at timestamptz not null default now(),
  raw_payload jsonb,

  created_at timestamptz not null default now()
);

-- Idempotência: o mesmo evento (mesma plataforma + mesmo id externo) nunca
-- gera duas submissões, mesmo que o webhook reentregue a notificação.
create unique index lead_submissions_platform_external_id_unique_idx
  on public.lead_submissions (platform, external_lead_id)
  where external_lead_id is not null;

create index lead_submissions_lead_id_idx
  on public.lead_submissions (lead_id, submitted_at desc);

create index lead_submissions_campaign_id_idx
  on public.lead_submissions (campaign_id);

alter table public.lead_submissions enable row level security;

create policy "authenticated read lead_submissions" on public.lead_submissions
  for select using (auth.role() = 'authenticated');

-- raw_payload é dado bruto (pode incluir informações sensíveis do
-- formulário) — leitura restrita ao backend (service_role bypassa RLS e
-- privilégios de coluna). O app autenticado só lê os metadados de
-- atribuição, nunca o payload cru.
revoke select on public.lead_submissions from authenticated;
grant select (
  id, lead_id, external_lead_id, source, platform,
  campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
  form_id, form_name, submitted_at, created_at
) on public.lead_submissions to authenticated;

-- Sem policy de insert/update/delete para "authenticated": submissões só
-- são criadas pelo backend (service_role), a partir dos webhooks.

-- ─────────────────────────────────────────────────────────────
-- Migra a atribuição já existente em leads.meta_leadgen_id / raw_payload
-- para uma submissão inicial, para quem já tinha leads antes desta
-- migration (idempotente: não duplica se rodada mais de uma vez).
-- ─────────────────────────────────────────────────────────────

insert into public.lead_submissions (
  lead_id, external_lead_id, source, platform, campaign_id, submitted_at, raw_payload
)
select
  l.id,
  l.meta_leadgen_id,
  l.origin,
  'meta',
  l.campaign_id,
  l.created_at,
  l.raw_payload
from public.leads l
where l.meta_leadgen_id is not null
  and not exists (
    select 1 from public.lead_submissions s
    where s.platform = 'meta' and s.external_lead_id = l.meta_leadgen_id
  );

-- ─────────────────────────────────────────────────────────────
-- insert_lead_submission_idempotent: insere a submissão sem duplicar
--
-- O índice único acima é parcial (`where external_lead_id is not null`),
-- e o Postgres exige que o alvo do ON CONFLICT bata exatamente com o
-- predicado do índice — o que os query builders (ex: supabase-js
-- `.upsert()`) não conseguem expressar. Por isso o "on conflict ... where
-- ... do nothing" fica encapsulado aqui, chamado via RPC pelo backend.
-- Retorna null quando a linha já existia (reentrega de webhook).
-- ─────────────────────────────────────────────────────────────

create or replace function public.insert_lead_submission_idempotent(
  p_lead_id uuid,
  p_external_lead_id text,
  p_source text,
  p_platform text,
  p_campaign_id uuid,
  p_campaign_name text,
  p_adset_id text,
  p_adset_name text,
  p_ad_id text,
  p_ad_name text,
  p_form_id text,
  p_form_name text,
  p_submitted_at timestamptz,
  p_raw_payload jsonb
)
returns public.lead_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lead_submissions;
begin
  insert into public.lead_submissions (
    lead_id, external_lead_id, source, platform, campaign_id, campaign_name,
    adset_id, adset_name, ad_id, ad_name, form_id, form_name, submitted_at, raw_payload
  )
  values (
    p_lead_id, p_external_lead_id, p_source, p_platform, p_campaign_id, p_campaign_name,
    p_adset_id, p_adset_name, p_ad_id, p_ad_name, p_form_id, p_form_name, p_submitted_at, p_raw_payload
  )
  on conflict (platform, external_lead_id) where external_lead_id is not null
  do nothing
  returning * into v_row;

  return v_row; -- linha vazia (todas as colunas null) quando já existia
end;
$$;

revoke all on function public.insert_lead_submission_idempotent(
  uuid, text, text, text, uuid, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.insert_lead_submission_idempotent(
  uuid, text, text, text, uuid, text, text, text, text, text, text, text, timestamptz, jsonb
) to service_role;
