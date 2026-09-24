import "server-only";

/**
 * Cliente mínimo para a Graph API do Meta (Lead Ads).
 * Docs: https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving
 *
 * Confira a versão estável atual em
 * https://developers.facebook.com/docs/graph-api/changelog antes de ir para
 * produção — versões antigas são desativadas periodicamente pela Meta.
 */
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v23.0";

export interface MetaLeadFieldData {
  name: string;
  values: string[];
}

export interface MetaLeadResponse {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data: MetaLeadFieldData[];
}

/**
 * Busca os dados completos de um lead a partir do leadgen_id recebido no
 * webhook. Exige o token de acesso da página/app com a permissão
 * `leads_retrieval` (e app aprovado no App Review da Meta).
 */
export async function fetchMetaLead(leadgenId: string): Promise<MetaLeadResponse> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");

  const fields = [
    "id",
    "created_time",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "form_id",
    "field_data",
  ].join(",");

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?fields=${fields}&access_token=${token}`;

  const response = await fetch(url, { method: "GET" });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error?.message ?? "Erro ao consultar a Graph API do Meta");
  }

  return json as MetaLeadResponse;
}

/**
 * Normaliza o `field_data` (formato nome/valor livre do formulário) para um
 * objeto simples. Os nomes dos campos dependem de como o formulário foi
 * configurado no Meta Ads Manager — ajuste o mapeamento em
 * `normalizeMetaLead` (webhooks/meta) conforme os campos reais usados.
 */
export function fieldDataToRecord(fieldData: MetaLeadFieldData[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of fieldData) {
    record[field.name] = field.values?.[0] ?? "";
  }
  return record;
}
