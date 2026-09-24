import "server-only";

/**
 * Remove padrões que parecem token/segredo antes de qualquer log chegar
 * ao banco (integration_logs) ou a qualquer saída. Defesa em profundidade:
 * o código nunca deveria logar um token de propósito, mas mensagens de
 * erro de terceiros (ex: corpo de resposta de uma API) podem ecoar o
 * valor enviado.
 */
const SECRET_KEY_PATTERN =
  /("?(?:access_token|token|secret|authorization|api_key|apikey|password)"?\s*[:=]\s*")([^"\s]+)(")?/gi;
const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9._-]+/gi;

export function sanitizeText(input: string): string {
  return input
    .replace(BEARER_PATTERN, "$1[REDACTED]")
    .replace(SECRET_KEY_PATTERN, (_match, prefix, _value, suffix = "") => `${prefix}[REDACTED]${suffix}`);
}

const SENSITIVE_KEY_NAMES = new Set([
  "access_token",
  "accesstoken",
  "token",
  "secret",
  "authorization",
  "api_key",
  "apikey",
  "password",
  "service_role_key",
]);

/** Sanitiza recursivamente um objeto antes de virar `context` em integration_logs. */
export function sanitizeContext(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 5) return "[TRUNCATED]";

  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeContext(item, depth + 1));

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_NAMES.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeContext(val, depth + 1);
      }
    }
    return result;
  }

  return value;
}
