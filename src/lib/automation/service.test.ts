import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSkipReason, processPendingAutomationJobs } from "@/lib/automation/service";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";
import type { Lead } from "@/types/domain";

const { sendWhatsAppTemplateMock } = vi.hoisted(() => ({
  sendWhatsAppTemplateMock: vi.fn(),
}));

vi.mock("@/lib/whatsapp/cloud-api", () => ({
  sendWhatsAppTemplate: sendWhatsAppTemplateMock,
}));

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

describe("processPendingAutomationJobs — AUTOMATION_DRY_RUN=true", () => {
  const originalDryRun = process.env.AUTOMATION_DRY_RUN;

  beforeEach(() => {
    process.env.AUTOMATION_DRY_RUN = "true";
  });

  afterEach(() => {
    process.env.AUTOMATION_DRY_RUN = originalDryRun;
  });

  it("simula o job sem tocar em leads/messages/conversations — só timeline + job", async () => {
    const claimedJob = { id: "job-1", lead_id: "lead-1", template_id: null, attempts: 1 };
    const leadRow = baseLead();
    const templateRow = {
      id: "tmpl-1",
      key: "first_contact",
      name: "Primeiro contato",
      body: "Oi, {{nome}}!",
      variables: ["nome"],
      wa_template_name: null,
      wa_template_language: "pt_BR",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { client, calls } = createFakeSupabase([
      { data: [claimedJob], error: null }, // claim_due_automation_jobs
      { data: leadRow, error: null }, // leads select
      { data: templateRow, error: null }, // message_templates select
      { data: null, error: null }, // lead_activities insert (automacao_simulada)
      { data: null, error: null }, // automation_jobs update (status=simulated)
    ]);

    const results = await processPendingAutomationJobs(25, client as never);

    expect(results).toEqual([{ jobId: "job-1", leadId: "lead-1", outcome: "simulated" }]);

    const tablesTouched = calls.map((c) => c.table);
    expect(tablesTouched).toEqual([
      "rpc:claim_due_automation_jobs",
      "leads",
      "message_templates",
      "lead_activities",
      "automation_jobs",
    ]);
    // Nenhum efeito comercial: sem update em "leads", sem "messages", sem "conversations".
    expect(tablesTouched).not.toContain("messages");
    expect(tablesTouched).not.toContain("conversations");
    expect(tablesTouched.filter((t) => t === "leads")).toHaveLength(1); // só o select inicial
  });
});

describe("processPendingAutomationJobs — AUTOMATION_DRY_RUN=false (envio real)", () => {
  const originalDryRun = process.env.AUTOMATION_DRY_RUN;

  beforeEach(() => {
    process.env.AUTOMATION_DRY_RUN = "false";
    sendWhatsAppTemplateMock.mockReset();
  });

  afterEach(() => {
    process.env.AUTOMATION_DRY_RUN = originalDryRun;
  });

  it("falha de forma controlada quando o template não tem wa_template_name (não chama a API)", async () => {
    const claimedJob = { id: "job-2", lead_id: "lead-2", template_id: null, attempts: 0 };
    const leadRow = baseLead({ id: "lead-2" });
    const templateRow = {
      id: "tmpl-1",
      key: "first_contact",
      name: "Primeiro contato",
      body: "Oi, {{nome}}!",
      variables: ["nome"],
      wa_template_name: null, // ainda não aprovado no WhatsApp Manager
      wa_template_language: "pt_BR",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { client, calls } = createFakeSupabase([
      { data: [claimedJob], error: null }, // claim_due_automation_jobs
      { data: leadRow, error: null }, // leads select
      { data: templateRow, error: null }, // message_templates select
      { data: null, error: null }, // automation_jobs update (failJob)
    ]);

    const results = await processPendingAutomationJobs(25, client as never);

    expect(results).toEqual([
      { jobId: "job-2", leadId: "lead-2", outcome: "failed", detail: expect.stringContaining("wa_template_name") },
    ]);
    expect(sendWhatsAppTemplateMock).not.toHaveBeenCalled();
    expect(calls.map((c) => c.table)).not.toContain("messages");
  });

  it("envia via template aprovado e só então marca o lead como contatado", async () => {
    sendWhatsAppTemplateMock.mockResolvedValue({ ok: true, waMessageId: "wamid.TEST123" });

    const claimedJob = { id: "job-3", lead_id: "lead-3", template_id: null, attempts: 0 };
    const leadRow = baseLead({ id: "lead-3", full_name: "Ana Souza", company_name: "Padaria Sabor" });
    const templateRow = {
      id: "tmpl-1",
      key: "first_contact",
      name: "Primeiro contato",
      body: "Oi, {{nome}}! Vi que a {{empresa}} pediu um diagnóstico.",
      variables: ["nome", "empresa"],
      wa_template_name: "primeiro_contato",
      wa_template_language: "pt_BR",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { client, calls } = createFakeSupabase([
      { data: [claimedJob], error: null }, // claim_due_automation_jobs
      { data: leadRow, error: null }, // leads select
      { data: templateRow, error: null }, // message_templates select
      { data: null, error: null }, // conversations select (getOrCreateConversation)
      { data: { id: "conv-1" }, error: null }, // conversations insert
      { data: null, error: null }, // messages insert
      { data: null, error: null }, // conversations update last_message_at
      { data: null, error: null }, // leads update stage/contacted_at
      { data: null, error: null }, // lead_activities insert
      { data: null, error: null }, // automation_jobs update status=sent
    ]);

    const results = await processPendingAutomationJobs(25, client as never);

    expect(results).toEqual([{ jobId: "job-3", leadId: "lead-3", outcome: "sent" }]);
    expect(sendWhatsAppTemplateMock).toHaveBeenCalledWith(
      "11988881001",
      "primeiro_contato",
      "pt_BR",
      ["Ana", "Padaria Sabor"],
    );

    const tablesTouched = calls.map((c) => c.table);
    expect(tablesTouched).toContain("messages");
    expect(tablesTouched.filter((t) => t === "leads")).toHaveLength(2); // select inicial + update de contato
  });
});
