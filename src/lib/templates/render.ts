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

/**
 * Resolve `template.variables` (ex: ['nome', 'empresa']) para os valores
 * do lead, na mesma ordem — é o que a WhatsApp Cloud API espera como
 * `parameters` posicionais ({{1}}, {{2}}...) de um Message Template
 * aprovado pela Meta. A ordem em `variables` precisa bater exatamente
 * com a ordem dos placeholders no template cadastrado no WhatsApp Manager.
 */
export function resolveTemplateVariables(template: MessageTemplate, lead: Lead): string[] {
  return template.variables.map((key) => TEMPLATE_VARS[key]?.(lead) ?? "");
}
