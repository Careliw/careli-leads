-- Novo tipo de atividade: registrar quando um contato já existente envia
-- uma nova submissão (formulário preenchido de novo, outra campanha/anúncio)
-- sem que isso vire um lead duplicado — ver 0004_lead_submissions.sql.

alter type activity_type add value if not exists 'nova_submissao';
