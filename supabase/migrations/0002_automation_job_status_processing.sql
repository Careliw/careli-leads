-- Adiciona o status "processing" ao enum automation_job_status.
--
-- Fica isolado em sua própria migration de propósito: o Postgres não
-- permite usar um valor de enum recém-criado (em WHERE, default, etc.) na
-- mesma transação em que ele foi adicionado, e cada arquivo de migration
-- roda como uma transação própria. A lógica que usa "processing" vem na
-- próxima migration (0003_automation_hardening.sql).

alter type automation_job_status add value if not exists 'processing';
