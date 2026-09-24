import type { Lead, MessageTemplate } from "@/types/domain";

const TEMPLATE_VARS: Record<string, (lead: Lead) => string> = {
  nome: (lead) => lead.full_name.split(" ")[0] ?? lead.full_name,
  empresa: (lead) => lead.company_name ?? "sua empresa",
  cidade: (lead) => lead.city ?? "",
  segmento: (lead) => lead.segment ?? "",
};

export function renderTemplate(template: MessageTemplate, lead: Lead): string {
  return template.body.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => {
    const resolver = TEMPLATE_VARS[key];
    return resolver ? resolver(lead) : match;
  });
}
