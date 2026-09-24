import { describe, expect, it } from "vitest";
import { buildMissingFieldsPatch, upsertLeadFromSubmission } from "@/lib/leads/upsert-lead";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";

const EXISTING_LEAD_BASE = {
  id: "lead-5",
  email: null,
  company_name: "ACME",
  city: "São Paulo",
  segment: null,
  already_on_google: null,
  relation_to_company: null,
};

describe("buildMissingFieldsPatch", () => {
  it("preenche apenas os campos vazios do lead existente", () => {
    const patch = buildMissingFieldsPatch(EXISTING_LEAD_BASE, {
      fullName: "x",
      phone: "11988881001",
      origin: "meta_lead_ads",
      platform: "meta",
      email: "novo@empresa.com",
      companyName: "Outra Empresa",
      segment: "Óticas",
    });

    expect(patch).toEqual({ email: "novo@empresa.com", segment: "Óticas" });
    // company_name já existia (ACME) — não deve ser sobrescrito.
    expect(patch).not.toHaveProperty("company_name");
  });

  it("não sobrescreve already_on_google=false com um novo valor (false é um valor válido, não 'vazio')", () => {
    const patch = buildMissingFieldsPatch(
      { ...EXISTING_LEAD_BASE, already_on_google: false },
      {
        fullName: "x",
        phone: "11988881001",
        origin: "meta_lead_ads",
        platform: "meta",
        alreadyOnGoogle: true,
      },
    );

    expect(patch).not.toHaveProperty("already_on_google");
  });

  it("retorna objeto vazio quando não há nada novo para preencher", () => {
    const patch = buildMissingFieldsPatch(EXISTING_LEAD_BASE, {
      fullName: "x",
      phone: "11988881001",
      origin: "meta_lead_ads",
      platform: "meta",
    });

    expect(patch).toEqual({});
  });
});

describe("upsertLeadFromSubmission (deduplicação + idempotência)", () => {
  it("evento redelivered (mesmo leadgen_id) é ignorado sem nenhuma escrita nova", async () => {
    const { client, calls } = createFakeSupabase([
      // lead_submissions: já existe uma submissão com esse external_lead_id
      { data: { lead_id: "lead-5" }, error: null },
    ]);

    const result = await upsertLeadFromSubmission(
      {
        fullName: "Marcos Oliveira",
        phone: "11988881001",
        origin: "meta_lead_ads",
        platform: "meta",
        externalLeadId: "leadgen-123",
      },
      client as never,
    );

    expect(result).toEqual({ leadId: "lead-5", isNewLead: false, isDuplicateSubmission: true });
    // nenhuma escrita: só a checagem de idempotência foi consultada.
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("lead_submissions");
  });

  it("telefone novo cria um lead, registra a submissão e agenda o primeiro contato", async () => {
    const { client, calls } = createFakeSupabase([
      { data: null, error: null }, // lead_submissions: nenhum evento igual antes
      { data: null, error: null }, // leads: nenhum lead com esse telefone
      {
        data: {
          id: "lead-99",
          email: null,
          company_name: null,
          city: null,
          segment: null,
          already_on_google: null,
          relation_to_company: null,
        },
        error: null,
      }, // leads: insert
      { data: { id: "sub-1" }, error: null }, // rpc insert_lead_submission_idempotent
      { data: null, error: null }, // lead_activities: "lead_recebido"
      { data: { id: "tmpl-1" }, error: null }, // scheduleFirstContact: message_templates select
      { data: null, error: null }, // scheduleFirstContact: automation_jobs insert
      { data: null, error: null }, // scheduleFirstContact: lead_activities "Contato agendado"
    ]);

    const result = await upsertLeadFromSubmission(
      {
        fullName: "Novo Lead",
        phone: "11977776002",
        origin: "meta_lead_ads",
        platform: "meta",
        externalLeadId: "leadgen-999",
      },
      client as never,
    );

    expect(result).toEqual({ leadId: "lead-99", isNewLead: true, isDuplicateSubmission: false });

    const tablesTouched = calls.map((c) => c.table);
    expect(tablesTouched).toEqual([
      "lead_submissions",
      "leads",
      "leads",
      "rpc:insert_lead_submission_idempotent",
      "lead_activities",
      "message_templates",
      "automation_jobs",
      "lead_activities",
    ]);
  });

  it("telefone já cadastrado: não duplica o lead, só registra nova submissão + atividade", async () => {
    const { client, calls } = createFakeSupabase([
      { data: null, error: null }, // lead_submissions: novo external_lead_id, ainda não visto
      { data: EXISTING_LEAD_BASE, error: null }, // leads: já existe pelo telefone
      { data: null, error: null }, // leads: update (preenche campo vazio)
      { data: { id: "sub-2" }, error: null }, // rpc insert_lead_submission_idempotent
      { data: null, error: null }, // lead_activities: "nova_submissao"
    ]);

    const result = await upsertLeadFromSubmission(
      {
        fullName: "Marcos Oliveira",
        phone: "11988881001",
        origin: "meta_lead_ads",
        platform: "meta",
        externalLeadId: "leadgen-456",
        email: "marcos@oticavisao.com.br",
        campaignName: "Campanha nova",
      },
      client as never,
    );

    expect(result).toEqual({ leadId: "lead-5", isNewLead: false, isDuplicateSubmission: false });

    const tablesTouched = calls.map((c) => c.table);
    // Nunca chama scheduleFirstContact de novo para um contato já existente.
    expect(tablesTouched).not.toContain("automation_jobs");
    expect(tablesTouched).toEqual([
      "lead_submissions",
      "leads",
      "leads",
      "rpc:insert_lead_submission_idempotent",
      "lead_activities",
    ]);
  });
});
