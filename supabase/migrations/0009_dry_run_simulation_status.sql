-- Separa claramente "job processado em modo de simulação" de "mensagem
-- realmente enviada":
--
--   automation_jobs.status = 'simulated' — o worker rodou em
--   AUTOMATION_DRY_RUN=true: reivindicou o job, validou tudo, mas não
--   chamou o WhatsApp nem produziu nenhum efeito comercial (lead
--   continua sem contacted_at, sem mudar de estágio, sem linha em
--   `messages`). Antes disso reutilizava o status 'sent', o que fazia o
--   dry-run parecer um envio real.
--
--   lead_activities.type = 'automacao_simulada' — atividade de teste na
--   timeline, claramente distinta de 'mensagem_enviada' (que continua
--   reservada para envio real confirmado pela WhatsApp Cloud API).

alter type automation_job_status add value if not exists 'simulated';
alter type activity_type add value if not exists 'automacao_simulada';
