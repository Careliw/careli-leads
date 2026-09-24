import { describe, expect, it } from "vitest";
import { getSkipReason } from "@/lib/automation/service";
import type { Lead } from "@/types/domain";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    owner_id: null,
    full_name: "Marcos Oliveira",
    phone: "11988881001",
    email: null,
    company_name: null,
    city: null,
    segment: null,
    already_on_google: null,
    relation_to_company: null,
    origin: "meta_lead_ads",
    meta_leadgen_id: null,
    campaign_id: null,
    stage: "novo_lead",
    notes: null,
    contacted_at: null,
    responded_at: null,
    closed_at: null,
    lost_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getSkipReason (guarda de idempotência do worker de automação)", () => {
  it("permite processar um lead novo, ainda não contatado", () => {
    expect(getSkipReason(baseLead())).toBeNull();
  });

  it("pula quando o lead já respondeu antes do worker rodar", () => {
    const reason = getSkipReason(baseLead({ responded_at: new Date().toISOString() }));
    expect(reason).toMatch(/respondeu/i);
  });

  it("pula quando o lead já foi contatado (evita reenviar a mesma mensagem)", () => {
    const reason = getSkipReason(baseLead({ contacted_at: new Date().toISOString() }));
    expect(reason).toMatch(/contatado/i);
  });

  it("pula quando o estágio já mudou manualmente antes do worker rodar", () => {
    const reason = getSkipReason(baseLead({ stage: "diagnostico" }));
    expect(reason).toMatch(/novo_lead/);
  });
});
