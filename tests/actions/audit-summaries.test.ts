import { describe, expect, it } from "vitest";
import { buildSummary, buildEntityLabel } from "@/lib/audit/summaries";

describe("buildSummary", () => {
  it("builds empresa create summary", () => {
    const result = buildSummary("empresa", "create", "XPTO Lda");
    expect(result).toBe("XPTO Lda criada.");
  });

  it("builds empresa update summary", () => {
    const result = buildSummary("empresa", "update", "XPTO Lda");
    expect(result).toBe("XPTO Lda atualizada.");
  });

  it("builds empresa archive summary", () => {
    const result = buildSummary("empresa", "archive", "XPTO Lda");
    expect(result).toBe("XPTO Lda arquivada.");
  });

  it("builds empresa restore summary", () => {
    const result = buildSummary("empresa", "restore", "XPTO Lda");
    expect(result).toBe("XPTO Lda restaurada.");
  });

  it("builds estagio create summary", () => {
    const result = buildSummary("estagio", "create", "Estágio do João");
    expect(result).toBe("Estágio criado: Estágio do João.");
  });

  it("builds estagio status_change summary", () => {
    const result = buildSummary("estagio", "status_change", "Estágio do João");
    expect(result).toBe("Estado do estágio alterado: Estágio do João.");
  });

  it("builds tutor associate summary", () => {
    const result = buildSummary("tutor", "associate", "Maria");
    expect(result).toBe("Tutor associado: Maria.");
  });

  it("builds schedule_change_request approve summary", () => {
    const result = buildSummary("schedule_change_request", "approve", "future_absence 2026-06-15");
    expect(result).toBe("Pedido de alteração aprovado: future_absence 2026-06-15.");
  });

  it("builds user permission_change summary", () => {
    const result = buildSummary("user", "permission_change", "João Silva");
    expect(result).toBe("Permissões de utilizador alteradas: João Silva.");
  });

  it("builds school update_settings summary without label", () => {
    const result = buildSummary("school", "update_settings");
    expect(result).toBe("Definições da escola atualizadas.");
  });

  it("builds fallback for unknown combination", () => {
    const result = buildSummary("empresa", "delete", "XPTO Lda");
    expect(result).toBe("XPTO Lda eliminada.");
  });

  it("uses entityType as fallback when no label", () => {
    const result = buildSummary("estagio", "create");
    expect(result).toBe("Estágio criado: estagio.");
  });
});

describe("buildEntityLabel", () => {
  it("extracts nome from empresa data", () => {
    const result = buildEntityLabel("empresa", { nome: "XPTO Lda" });
    expect(result).toBe("XPTO Lda");
  });

  it("extracts titulo from estagio data", () => {
    const result = buildEntityLabel("estagio", { titulo: "Estágio do João" });
    expect(result).toBe("Estágio do João");
  });

  it("falls back to id for estagio when no titulo", () => {
    const result = buildEntityLabel("estagio", { id: "estagio_123" });
    expect(result).toBe("estagio_123");
  });

  it("extracts nome from user data", () => {
    const result = buildEntityLabel("user", { nome: "João Silva", email: "joao@test.pt" });
    expect(result).toBe("João Silva");
  });

  it("falls back to email when no nome for user", () => {
    const result = buildEntityLabel("user", { displayName: "", email: "joao@test.pt" });
    expect(result).toBe("joao@test.pt");
  });

  it("extracts name from school data", () => {
    const result = buildEntityLabel("school", { name: "Escola Secundária" });
    expect(result).toBe("Escola Secundária");
  });

  it("builds schedule_change_request label from type and date", () => {
    const result = buildEntityLabel("schedule_change_request", {
      type: "future_absence",
      targetDate: "2026-06-15",
    });
    expect(result).toBe("future_absence - 2026-06-15");
  });

  it("returns empty string for unknown entity type", () => {
    const result = buildEntityLabel("school" as never, {});
    expect(result).toBe("");
  });
});
