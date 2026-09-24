-- Dados de exemplo para desenvolvimento local.
-- Rode depois da migração 0001_init.sql: supabase db reset (aplica migrations + seed)
-- ou cole diretamente no SQL Editor do painel do Supabase.

insert into public.campaigns (id, meta_campaign_id, name, adset_name, ad_name)
values
  ('11111111-1111-1111-1111-111111111111', 'camp_diagnostico_google', 'Diagnóstico Google - Setembro', 'Comerciantes locais 25-55', 'Vídeo depoimento'),
  ('22222222-2222-2222-2222-222222222222', 'camp_lookalike', 'Lookalike clientes atuais', 'LAL 1% BR', 'Carrossel antes/depois');

insert into public.leads
  (id, full_name, phone, email, company_name, city, segment, already_on_google, relation_to_company, origin, campaign_id, stage, notes, contacted_at, responded_at, created_at)
values
  ('a1111111-0000-0000-0000-000000000001', 'Marcos Oliveira', '+55 11 98888-1001', 'marcos@oticavisao.com.br', 'Ótica Visão', 'São Paulo', 'Óticas', false, 'Dono', 'meta_lead_ads', '11111111-1111-1111-1111-111111111111', 'novo_lead', null, null, null, now() - interval '5 minutes'),
  ('a1111111-0000-0000-0000-000000000002', 'Fernanda Lima', '+55 21 97777-1002', 'fernanda@clinicasorriso.com', 'Clínica Sorriso', 'Rio de Janeiro', 'Odontologia', true, 'Gerente', 'meta_lead_ads', '11111111-1111-1111-1111-111111111111', 'contato_enviado', null, now() - interval '2 hours', null, now() - interval '3 hours'),
  ('a1111111-0000-0000-0000-000000000003', 'Carlos Souza', '+55 31 96666-1003', null, 'Auto Peças Souza', 'Belo Horizonte', 'Autopeças', false, 'Dono', 'meta_lead_ads', '22222222-2222-2222-2222-222222222222', 'respondeu', 'Cliente pediu para ligar à noite.', now() - interval '1 day', now() - interval '20 hours', now() - interval '1 day'),
  ('a1111111-0000-0000-0000-000000000004', 'Juliana Prado', '+55 41 95555-1004', 'juliana@studioprado.com', 'Studio Prado Estética', 'Curitiba', 'Estética', true, 'Dona', 'meta_lead_ads', '22222222-2222-2222-2222-222222222222', 'diagnostico', null, now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'),
  ('a1111111-0000-0000-0000-000000000005', 'Roberto Alves', '+55 51 94444-1005', null, 'Alves Advocacia', 'Porto Alegre', 'Serviços jurídicos', false, 'Sócio', 'meta_lead_ads', '11111111-1111-1111-1111-111111111111', 'interessado', 'Muito interessado, quer proposta ainda essa semana.', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('a1111111-0000-0000-0000-000000000006', 'Patrícia Nunes', '+55 61 93333-1006', 'patricia@nunesimoveis.com', 'Nunes Imóveis', 'Brasília', 'Imobiliária', true, 'Corretora', 'meta_lead_ads', '22222222-2222-2222-2222-222222222222', 'proposta', 'Proposta enviada, aguardando retorno.', now() - interval '4 days', now() - interval '4 days', now() - interval '4 days'),
  ('a1111111-0000-0000-0000-000000000007', 'Eduardo Martins', '+55 71 92222-1007', null, 'Martins Contabilidade', 'Salvador', 'Contabilidade', false, 'Dono', 'meta_lead_ads', '11111111-1111-1111-1111-111111111111', 'fechado', 'Fechado! Plano anual.', now() - interval '10 days', now() - interval '10 days', now() - interval '10 days'),
  ('a1111111-0000-0000-0000-000000000008', 'Simone Costa', '+55 81 91111-1008', null, 'Pet Shop Amigo Fiel', 'Recife', 'Pet shop', true, 'Dona', 'meta_lead_ads', '22222222-2222-2222-2222-222222222222', 'perdido', 'Disse que não tem orçamento no momento.', now() - interval '6 days', now() - interval '6 days', now() - interval '6 days');

insert into public.lead_activities (lead_id, type, title, description, created_at)
values
  ('a1111111-0000-0000-0000-000000000001', 'lead_recebido', 'Lead recebido', 'Primeiro contato agendado', now() - interval '5 minutes'),
  ('a1111111-0000-0000-0000-000000000002', 'lead_recebido', 'Lead recebido', 'Primeiro contato agendado', now() - interval '3 hours'),
  ('a1111111-0000-0000-0000-000000000002', 'mensagem_enviada', 'Mensagem de primeiro contato enviada', 'Oi, Fernanda! Aqui é o Wesley...', now() - interval '2 hours 50 minutes'),
  ('a1111111-0000-0000-0000-000000000003', 'resposta_recebida', 'Resposta recebida', 'Pode ligar depois das 19h', now() - interval '20 hours'),
  ('a1111111-0000-0000-0000-000000000004', 'diagnostico_feito', 'Diagnóstico feito', 'Empresa não aparece bem no Google Meu Negócio', now() - interval '1 day'),
  ('a1111111-0000-0000-0000-000000000005', 'observacao_adicionada', 'Observação adicionada', 'Muito interessado, quer proposta ainda essa semana.', now() - interval '2 days'),
  ('a1111111-0000-0000-0000-000000000006', 'proposta_enviada', 'Proposta enviada', 'Plano mensal + anúncios locais', now() - interval '3 days'),
  ('a1111111-0000-0000-0000-000000000007', 'venda', 'Venda fechada', 'Plano anual assinado', now() - interval '9 days'),
  ('a1111111-0000-0000-0000-000000000008', 'perda', 'Lead perdido', 'Sem orçamento no momento', now() - interval '5 days');
