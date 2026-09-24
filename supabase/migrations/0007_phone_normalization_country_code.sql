-- Corrige uma lacuna de deduplicação: `phone_normalized` (0001) só tirava
-- caracteres não-numéricos, então "+55 11 98888-1001" e "11988881001" —
-- o MESMO telefone, com e sem DDI — geravam valores diferentes e o índice
-- único não pegava a duplicata. Agora o DDI 55 é normalizado: números com
-- 10 ou 11 dígitos (DDD + número, sem DDI) recebem o prefixo "55".
--
-- Reflete a mesma regra usada em src/lib/phone.ts (normalizePhoneDigits) —
-- qualquer mudança em uma precisa ser espelhada na outra.

alter table public.leads drop column phone_normalized cascade;

alter table public.leads add column phone_normalized text generated always as (
  case
    when length(regexp_replace(phone, '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(phone, '\D', '', 'g')
    else regexp_replace(phone, '\D', '', 'g')
  end
) stored;

create unique index leads_phone_normalized_unique_idx
  on public.leads (phone_normalized)
  where phone_normalized is not null and phone_normalized <> '';
