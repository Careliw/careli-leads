import { describe, expect, it } from "vitest";
import { cancelPendingAutomation } from "@/lib/automation/scheduler";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";

describe("cancelPendingAutomation", () => {
  it("cancela jobs ativos e registra uma atividade quando havia algo para cancelar", async () => {
    const { client, calls } = createFakeSupabase([
      // update(...).eq(...).in(...).select("id") -> jobs cancelados
      { data: [{ id: "job-1" }], error: null },
      // insert da atividade "automacao_cancelada"
      { data: null, error: null },
    ]);

    await cancelPendingAutomation("lead-1", "Lead respondeu antes do envio automático", client as never);

    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe("automation_jobs");
    expect(calls[0].methods).toContain("update");
    expect(calls[1].table).toBe("lead_activities");
    expect(calls[1].methods).toContain("insert");
  });

  it("não registra atividade quando não havia job pendente/processing para cancelar", async () => {
    const { client, calls } = createFakeSupabase([
      // nenhum job estava pending/processing
      { data: [], error: null },
    ]);

    await cancelPendingAutomation("lead-2", "Lead respondeu antes do envio automático", client as never);

    // só a chamada de update/select — nenhuma segunda chamada de insert.
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("automation_jobs");
  });

  it("propaga erro do banco em vez de mascará-lo", async () => {
    const { client } = createFakeSupabase([{ data: null, error: { message: "boom", code: "500" } }]);

    await expect(
      cancelPendingAutomation("lead-3", "motivo qualquer", client as never),
    ).rejects.toMatchObject({ message: "boom" });
  });
});
