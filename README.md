# Careli Leads

CRM web para um gestor de tráfego acompanhar leads do Meta Lead Ads, disparar o
primeiro contato automático pelo WhatsApp (10 min após a entrada) e conduzir o
lead por um pipeline comercial até venda ou perda.

> **Status:** em produção em https://careli-leads.netlify.app (Supabase real,
> Auth funcionando, worker de automação rodando via pg_cron a cada minuto em
> `AUTOMATION_DRY_RUN=true`). Meta Lead Ads e WhatsApp Business Platform
> **ainda não estão conectados** — os webhooks existem e são idempotentes,
> mas só devem ser ligados a apps/números reais numa etapa seguinte (ver
> "Próximos passos" no final). Banco de produção sem dados fictícios.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Realtime, `pg_cron` + `pg_net`)
- Deploy: **Netlify**

## Arquitetura

```
Meta Lead Ads (webhook)  ──┐
                            ├─▶ upsertLeadFromSubmission ─▶ leads / lead_submissions
WhatsApp Cloud API (webhook)┘        │
                                      ▼
                              scheduleFirstContact ─▶ automation_jobs (status=pending)
                                      │
                     Supabase pg_cron (a cada minuto)
                                      │
                                      ▼
                     pg_net → POST /api/automation/run
                                      │
                                      ▼
                     processPendingAutomationJobs()  (src/lib/automation/service.ts)
                        1. claim_due_automation_jobs()  — SELECT ... FOR UPDATE SKIP LOCKED
                        2. revalida o lead (já respondeu? já foi contatado?)
                        3. envia WhatsApp, registra mensagem + atividade
                        4. marca o job como sent/canceled/failed
```

A regra de negócio do worker (`processPendingAutomationJobs`) não sabe quem a
chama — hoje é o Supabase pg_cron, mas poderia ser uma Netlify Scheduled
Function, um QStash, ou uma chamada manual, sem mudar nada nela.

### Deduplicação de leads

Um contato é identificado principalmente pelo **telefone normalizado**
(`leads.phone_normalized`, coluna gerada no Postgres — dígitos apenas, com
DDI 55 assumido quando ausente, para "+55 11 98888-1001" e "11988881001"
caírem no mesmo valor). Quando a mesma pessoa envia o formulário de novo:

- o contato existente é localizado pelo telefone;
- campos vazios são preenchidos com os novos dados (nunca sobrescreve o que
  já existia);
- uma nova linha é criada em `lead_submissions`, preservando campanha/
  anúncio daquela submissão específica;
- uma atividade "Nova submissão recebida" entra na timeline.

Nada é descartado silenciosamente e o contato nunca é duplicado — ver
`src/lib/leads/upsert-lead.ts`.

### Idempotência

- **Webhooks reentregues** (Meta pode reenviar o mesmo evento): dedupe por
  `(platform, external_lead_id)` em `lead_submissions` e por `wa_message_id`
  em `messages`, ambos com índice único.
- **automation_jobs**: índice único parcial `(lead_id, type)` impede dois
  jobs ativos para o mesmo lead. `claim_due_automation_jobs()` reivindica
  jobs vencidos com `SELECT ... FOR UPDATE SKIP LOCKED` dentro de uma
  função do Postgres — dois workers rodando ao mesmo tempo nunca processam
  o mesmo job duas vezes, e locks de um worker que caiu no meio da execução
  são retomados depois de alguns minutos.
- **Atividades da timeline**: `lead_activities.dedupe_key` (opcional, único)
  evita duplicar a mesma atividade quando um evento externo é reprocessado.

## Instalação local

```bash
npm install
cp .env.example .env.local   # preencha com as credenciais do seu projeto Supabase
```

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode as migrations em `supabase/migrations/` **na ordem numérica**
   (SQL Editor do painel, ou `supabase db push` com a CLI). Elas são
   incrementais — nenhuma reescreve uma migration anterior.
3. Crie um usuário em Authentication → Users para conseguir logar no CRM.
4. Preencha `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
5. `npm run dev` e acesse http://localhost:3000

Sem as variáveis do Supabase configuradas, o app sobe normalmente mas mostra
um aviso "Supabase ainda não configurado" em vez de dados reais — útil para
revisar a UI sem depender de credenciais.

### Seed de demonstração (só em desenvolvimento)

`supabase/seed.sql` tem leads fictícios para testar a UI. Ele **nunca roda
automaticamente** — é um arquivo comum, só executado quando você explicitamente
pedir (SQL Editor, ou `supabase db reset` num projeto **local**). Nunca rode
`db reset` nem cole esse arquivo no SQL Editor de um projeto de produção.

### Testes

```bash
npm run test        # vitest — normalização de telefone, deduplicação,
                     # idempotência de automation_jobs, cancelamento de job
npm run lint
npm run typecheck
npm run build
```

## Deploy na Netlify

Next.js (App Router) é suportado nativamente pela Netlify via
`@netlify/plugin-nextjs`, detectado e instalado automaticamente — não é
necessário (nem recomendado) fixar a versão do plugin. Route Handlers,
Server Actions e o `proxy.ts` (middleware) viram Netlify Functions/Edge
Functions sem configuração extra.

- **Build command:** `npm run build` (definido em `netlify.toml`)
- **Publish directory:** `.next`
- **netlify.toml:** presente na raiz só para deixar build command/publish
  directory/versão do Node explícitos; o plugin do Next.js é auto-detectado.
- **Route Handlers** (`/api/webhooks/meta`, `/api/webhooks/whatsapp`,
  `/api/automation/run`) viram Netlify Functions automaticamente — nenhum
  redirect/rewrite manual é necessário.

### Passos

1. Conecte o repositório na Netlify (New site from Git → escolher o repo no
   GitHub, branch `main`). O deploy via upload direto (`netlify deploy`)
   não funcionou de forma confiável neste projeto (erro 500 recorrente);
   o caminho testado e funcionando é o deploy conectado ao Git, que também
   dá deploy automático a cada push.
2. Configure as environment variables (Site settings → Environment
   variables) — mesma lista do `.env.example`, com os valores reais:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTOMATION_CRON_SECRET` (gere um valor aleatório longo)
   - `AUTOMATION_DRY_RUN=true` enquanto o WhatsApp não estiver conectado
   - `META_*` e `WHATSAPP_*` só quando for conectar de verdade (etapa
     seguinte — ver abaixo)

   > ⚠️ **Não marque essas variáveis como "contains secret values" /
   > sensitive na Netlify.** Em teste real, variáveis marcadas como secret
   > não ficaram disponíveis em runtime para as Functions (erro
   > `supabaseKey is required.` mesmo com o valor salvo) — o mesmo valor
   > funcionou normalmente como env var comum. Isso não expõe nada ao
   > navegador: variáveis sem `NEXT_PUBLIC_` nunca entram no bundle do
   > cliente de qualquer forma, só ficam visíveis para quem tem acesso ao
   > painel da Netlify.
3. Deploy. A Netlify expõe a URL do site (ex: `https://careli-leads.netlify.app`).
4. **Ligue o worker de automação** (ver seção abaixo) apontando para
   `https://<seu-site>.netlify.app/api/automation/run`.
5. Teste os endpoints:
   ```bash
   curl "https://<seu-site>.netlify.app/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123"
   # deve devolver "123"

   curl -X POST https://<seu-site>.netlify.app/api/automation/run \
     -H "Authorization: Bearer $AUTOMATION_CRON_SECRET"
   # deve devolver {"processed":0,"results":[]} se não houver jobs pendentes
   ```

## Automações — Supabase pg_cron + pg_net

A migration `0005_automation_pg_cron_worker.sql` cria a infraestrutura
(schema `private`, tabela `private.app_settings`, função
`private.trigger_automation_worker()` e o job `cron.schedule(...)` rodando a
cada minuto) mas ela fica **inerte** até ser configurada — sem URL/segredo
salvos, a função não faz nada. Depois do primeiro deploy na Netlify, rode no
SQL Editor do Supabase:

```sql
insert into private.app_settings (key, value) values
  ('automation_worker_url', 'https://<seu-site>.netlify.app/api/automation/run'),
  ('automation_cron_secret', 'MESMO_VALOR_DE_AUTOMATION_CRON_SECRET')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

A partir daí, o pg_cron chama a rota a cada minuto via `pg_net`, que executa
`processPendingAutomationJobs()` (`src/lib/automation/service.ts`).

## Endpoints de webhook (preparados, ainda não conectados)

| Rota | Método | O que já está pronto |
|---|---|---|
| `/api/webhooks/meta` | `GET` | Verificação `hub.challenge` |
| `/api/webhooks/meta` | `POST` | Verificação de assinatura `X-Hub-Signature-256`, parse do evento `leadgen`, dedupe por `leadgen_id`, upsert de lead/submissão, log em `integration_logs` |
| `/api/webhooks/whatsapp` | `GET` | Verificação `hub.challenge` |
| `/api/webhooks/whatsapp` | `POST` | Verificação de assinatura, dedupe por `wa_message_id`, marca lead como "respondeu", cancela automação pendente |
| `/api/automation/run` | `GET`/`POST` | Protegido por `AUTOMATION_CRON_SECRET` (comparação em tempo constante), dispara `processPendingAutomationJobs()` |

## Segurança

- Nenhuma credencial no frontend — `SUPABASE_SERVICE_ROLE_KEY`, tokens do
  Meta e do WhatsApp só existem em variáveis server-only, lidas em módulos
  marcados `import "server-only"`.
- RLS habilitado em todas as tabelas; usuários autenticados leem/gerenciam
  dados do CRM, mas **não** leem `leads.raw_payload`,
  `lead_submissions.raw_payload` nem `integration_logs.context`
  (privilégio de coluna restrito a `service_role` — ver migrations 0003/0004).
- `integration_logs` e `lib/observability/sanitize.ts` removem qualquer
  padrão de token/segredo antes de gravar mensagem ou contexto.
- Webhooks validam `X-Hub-Signature-256` (HMAC com o App Secret da Meta,
  comparação em tempo constante) antes de processar qualquer payload.
- `/api/automation/run` exige `Authorization: Bearer <AUTOMATION_CRON_SECRET>`.
- `supabase/seed.sql` nunca roda automaticamente (ver acima).

## Migrations

Incrementais, nunca reescrevem uma anterior:

| Arquivo | O que faz |
|---|---|
| `0001_init.sql` | Schema inicial (leads, activities, conversations, messages, automation_jobs, templates, campaigns, settings, integration_logs, RLS) |
| `0002_automation_job_status_processing.sql` | Adiciona o status `processing` ao enum de automation_jobs (isolado por causa da regra do Postgres sobre `ALTER TYPE ... ADD VALUE`) |
| `0003_automation_hardening.sql` | Lock de concorrência (`locked_at`, `claim_due_automation_jobs()` com `FOR UPDATE SKIP LOCKED`), índice único ativo por lead+tipo, reestrutura `integration_logs`, restringe `raw_payload`/`context` a service_role |
| `0004_lead_submissions.sql` | Tabela `lead_submissions` + função `insert_lead_submission_idempotent()` (upsert idempotente respeitando índice único parcial) |
| `0005_automation_pg_cron_worker.sql` | `pg_cron` + `pg_net`, schema `private`, gatilho do worker a cada minuto |
| `0006_lead_activity_new_submission_type.sql` | Novo tipo de atividade `nova_submissao` |
| `0007_phone_normalization_country_code.sql` | Corrige `phone_normalized` para tratar DDI 55 ausente/presente como o mesmo telefone |

## Estrutura

```
src/
  app/(dashboard)/    páginas autenticadas (dashboard, leads, pipeline, automações, mensagens, configurações)
  app/api/webhooks/   webhooks do Meta e do WhatsApp (idempotentes, ainda não conectados)
  app/api/automation/run  worker de automação, chamado pelo Supabase pg_cron
  lib/data/           queries Supabase para a UI (server-only)
  lib/leads/          upsertLeadFromSubmission — dedupe/merge de contato
  lib/meta/           Graph API + verificação de assinatura de webhook
  lib/whatsapp/       WhatsApp Cloud API
  lib/automation/     scheduler.ts (comandos) + service.ts (worker desacoplado)
  lib/observability/  log.ts (integration_logs) + sanitize.ts (remove segredos de logs)
  lib/testing/        fake de Supabase para testes unitários
  components/crm/     componentes de domínio (kanban, timeline, cards...)
supabase/migrations/  schema do banco (incremental)
supabase/seed.sql     dados de exemplo — só para desenvolvimento local
```

## Próximos passos (fora do escopo desta etapa)

**Meta Lead Ads:**
1. Criar o App no Meta for Developers e configurar o produto Webhooks.
2. Conectar a Página do Facebook e o formulário de Lead Ads.
3. Cadastrar a URL `https://<seu-site>.netlify.app/api/webhooks/meta` com o
   `META_WEBHOOK_VERIFY_TOKEN` definido nas env vars.
4. Gerar um token de acesso de longa duração com permissão
   `leads_retrieval` e preencher `META_ACCESS_TOKEN`/`META_APP_SECRET`.
5. Ajustar o mapeamento de campos em `processLeadgenEvent`
   (`src/app/api/webhooks/meta/route.ts`) conforme os rótulos reais do
   formulário.
6. Testar com um lead real e confirmar que ele aparece no CRM.

**WhatsApp Business Platform:**
1. Criar/conectar o número no WhatsApp Business Platform (Cloud API).
2. Cadastrar a URL `https://<seu-site>.netlify.app/api/webhooks/whatsapp`.
3. Preencher `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Criar e submeter para aprovação o Message Template de primeiro contato
   (fora da janela de 24h, texto livre é rejeitado — usar
   `sendWhatsAppTemplate` em `src/lib/whatsapp/cloud-api.ts`).
5. Testar o fluxo completo: lead entra → 10 minutos depois recebe a
   mensagem automaticamente → responder cancela a automação.
