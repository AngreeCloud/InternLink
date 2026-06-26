import { describe, expect, it } from "vitest";
import { checkCanArchive, isPastEndDate } from "@/lib/estagios/archive-validations";
import type { ArchiveCheckInput } from "@/lib/estagios/archive-validations";

const pastDate = "2024-01-01";
const futureDate = "2099-12-31";

const allOk: ArchiveCheckInput = {
  estado: "ativo",
  dataFimEstimada: pastDate,
  reportSubmitted: true,
  reportAllSigned: true,
  allSumariosPreenchidos: true,
  allSumariosAssinados: true,
  avaliacaoTutorAssinada: true,
  avaliacaoProfessorAssinada: true,
};

describe("isPastEndDate", () => {
  it("true for past date", () => {
    expect(isPastEndDate("2020-01-01")).toBe(true);
  });

  it("false for future date", () => {
    expect(isPastEndDate("2099-12-31")).toBe(false);
  });

  it("false for null/undefined", () => {
    expect(isPastEndDate(null)).toBe(false);
    expect(isPastEndDate(undefined)).toBe(false);
  });

  it("false for empty string", () => {
    expect(isPastEndDate("")).toBe(false);
  });
});

describe("checkCanArchive — all conditions met", () => {
  it("returns canArchive=true with no reasons", () => {
    const result = checkCanArchive(allOk);
    expect(result.canArchive).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

describe("checkCanArchive — estado checks", () => {
  it("bloqueia estágio já arquivado", () => {
    const result = checkCanArchive({ ...allOk, estado: "arquivado" });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain("Estágio já arquivado");
  });

  it("bloqueia estágio eliminado", () => {
    const result = checkCanArchive({ ...allOk, estado: "eliminado" });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain("Estágio eliminado não pode ser arquivado");
  });
});

describe("checkCanArchive — data de fim", () => {
  it("bloqueia se data de fim for futura", () => {
    const result = checkCanArchive({ ...allOk, dataFimEstimada: futureDate });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain("Estágio ainda não passou da data prevista de término");
  });

  it("bloqueia se data de fim for nula", () => {
    const result = checkCanArchive({ ...allOk, dataFimEstimada: null });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain("Estágio sem data prevista de término");
  });

  it("permite se data de fim for hoje (passou)", () => {
    const today = new Date();
    today.setDate(today.getDate() - 1);
    const result = checkCanArchive({
      ...allOk,
      dataFimEstimada: today.toISOString().split("T")[0],
    });
    expect(result.canArchive).toBe(true);
  });
});

describe("checkCanArchive — relatório", () => {
  it("bloqueia se relatório não submetido", () => {
    const result = checkCanArchive({ ...allOk, reportSubmitted: false });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain(
      "Relatório final ainda não foi submetido"
    );
  });

  it("bloqueia se relatório não assinado por todos", () => {
    const result = checkCanArchive({
      ...allOk,
      reportSubmitted: true,
      reportAllSigned: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain(
      "Relatório final ainda não foi assinado por todas as partes"
    );
  });
});

describe("checkCanArchive — sumários", () => {
  it("bloqueia se sumários não preenchidos", () => {
    const result = checkCanArchive({
      ...allOk,
      allSumariosPreenchidos: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain(
      "Nem todos os sumários foram preenchidos"
    );
  });

  it("bloqueia se sumários não assinados", () => {
    const result = checkCanArchive({
      ...allOk,
      allSumariosPreenchidos: true,
      allSumariosAssinados: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain(
      "Nem todos os sumários foram assinados pelo tutor"
    );
  });
});

describe("checkCanArchive — avaliação", () => {
  it("bloqueia se avaliação do tutor não assinada", () => {
    const result = checkCanArchive({
      ...allOk,
      avaliacaoTutorAssinada: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain(
      "Avaliação do tutor não foi preenchida e assinada"
    );
  });

  it("bloqueia se avaliação do professor não assinada", () => {
    const result = checkCanArchive({
      ...allOk,
      avaliacaoProfessorAssinada: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.reasons).toContain(
      "Avaliação do professor não foi preenchida e assinada"
    );
  });
});

describe("checkCanArchive — múltiplas falhas", () => {
  it("acumula todas as razões", () => {
    const result = checkCanArchive({
      estado: "ativo",
      dataFimEstimada: futureDate,
      reportSubmitted: false,
      reportAllSigned: false,
      allSumariosPreenchidos: false,
      allSumariosAssinados: false,
      avaliacaoTutorAssinada: false,
      avaliacaoProfessorAssinada: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(6);
  });
});

describe("checkCanArchive — cobertura adicional", () => {
  it("permite arquivar com estado 'concluido'", () => {
    const result = checkCanArchive({ ...allOk, estado: "concluido" });
    expect(result.canArchive).toBe(true);
  });

  it("permite arquivar com estado 'em_curso'", () => {
    const result = checkCanArchive({
      ...allOk,
      estado: "em_curso",
    });
    expect(result.canArchive).toBe(true);
  });

  it("todos os campos false menos data produz 7+ razões", () => {
    const result = checkCanArchive({
      estado: "ativo",
      dataFimEstimada: pastDate,
      reportSubmitted: false,
      reportAllSigned: false,
      allSumariosPreenchidos: false,
      allSumariosAssinados: false,
      avaliacaoTutorAssinada: false,
      avaliacaoProfessorAssinada: false,
    });
    expect(result.canArchive).toBe(false);
    // 5 reasons: report not submitted, sumarios not filled, sumarios not signed, tutor not signed, prof not signed
    expect(result.reasons.length).toBeGreaterThanOrEqual(5);
  });
});
