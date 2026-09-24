/**
 * Normalização de telefone — mantida em sincronia byte-a-byte com a coluna
 * gerada `leads.phone_normalized` no Postgres (migration
 * 0007_phone_normalization_country_code.sql). Qualquer lookup de
 * deduplicação (`.eq("phone_normalized", ...)`) depende de produzir
 * exatamente o mesmo valor que o banco geraria — senão a mesma pessoa com
 * e sem o "+55" na frente vira dois contatos diferentes.
 *
 * Regra: tira tudo que não é dígito; se sobrarem 10 ou 11 dígitos (DDD +
 * número, sem DDI), assume Brasil e prefixa "55".
 */
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Formato E.164-ish usado pela WhatsApp Cloud API. */
export function toWhatsAppPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}
