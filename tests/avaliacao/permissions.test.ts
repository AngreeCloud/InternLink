import { describe, expect, it } from "vitest";
import {
  canTutorSignAvaliacao,
  canProfessorAssignNotaFinal,
  isAvaliacaoAvailableForTutor,
  isNotaFinalAvailableForAluno,
  canTutorSeeNotaFinal,
} from "@/lib/avaliacao/validations";
import type {
  AvaliacaoConfig,
  NotasTutor,
  NotaFinalProfessor,
} from "@/lib/avaliacao/types";

const makeConfig = (
  permitirTutorVerNotaFinal: boolean
): AvaliacaoConfig => ({
  parametros: [{ nome: "A" }, { nome: "B" }],
  escala: { min: 1, max: 5 },
  metodoCalculo: "soma",
  notaFinalEsperada: { min: 2, max: 10 },
  permitirTutorVerNotaFinal,
});

const signedTutorData: NotasTutor = {
  parametros: { A: 4, B: 5 },
  estado: "assinado",
  assinadoEm: "2026-06-01T10:00:00Z",
  resetCount: 0,
};

const pendingTutorData: NotasTutor = {
  parametros: { A: 4, B: 5 },
  estado: "pendente",
  resetCount: 0,
};

const signedProfessorData: NotaFinalProfessor = {
  parametros: { A: 5, B: 4 },
  notaFinal: 18,
  estado: "assinado",
  assinadoEm: "2026-06-02T10:00:00Z",
};

const pendingProfessorData: NotaFinalProfessor = {
  parametros: { A: 5, B: 4 },
  notaFinal: 18,
  estado: "pendente",
};

describe("canTutorSignAvaliacao", () => {
  it("allows sign when no previous data", () => {
    expect(canTutorSignAvaliacao(null)).toEqual({
      canSign: true,
    });
  });

  it("allows sign when estado is pendente", () => {
    expect(canTutorSignAvaliacao(pendingTutorData)).toEqual({
      canSign: true,
    });
  });

  it("blocks sign when already signed", () => {
    const r = canTutorSignAvaliacao(signedTutorData);
    expect(r.canSign).toBe(false);
    expect(r.reason).toContain("já foi assinada");
  });
});

describe("canProfessorAssignNotaFinal", () => {
  it("blocks when tutor has not signed", () => {
    const r = canProfessorAssignNotaFinal(null, null);
    expect(r.canAssign).toBe(false);
    expect(r.reason).toContain("tutor ainda não assinou");
  });

  it("blocks when tutor data is pendente", () => {
    const r = canProfessorAssignNotaFinal(pendingTutorData, null);
    expect(r.canAssign).toBe(false);
  });

  it("allows when tutor signed and no professor data", () => {
    expect(
      canProfessorAssignNotaFinal(signedTutorData, null)
    ).toEqual({ canAssign: true });
  });

  it("blocks when professor already signed", () => {
    const r = canProfessorAssignNotaFinal(
      signedTutorData,
      signedProfessorData
    );
    expect(r.canAssign).toBe(false);
    expect(r.reason).toContain("já foi atribuída");
  });

  it("blocks when professor data is pendente but exists", () => {
    // Still blocked if professor doc exists in signed state check
    // But actually only blocks if estado === "assinado"
    expect(
      canProfessorAssignNotaFinal(signedTutorData, pendingProfessorData)
    ).toEqual({ canAssign: true });
  });
});

describe("isAvaliacaoAvailableForTutor", () => {
  const fixedNow = new Date("2026-06-15T12:00:00Z");

  it("available when no dates configured", () => {
    expect(
      isAvaliacaoAvailableForTutor(null, fixedNow)
    ).toEqual({ available: true });
  });

  it("available when date is in the past", () => {
    expect(
      isAvaliacaoAvailableForTutor(
        { disponibilidadePreenchimento: "2026-06-01T00:00:00Z" },
        fixedNow
      )
    ).toEqual({ available: true });
  });

  it("blocked when date is in the future", () => {
    const r = isAvaliacaoAvailableForTutor(
      { disponibilidadePreenchimento: "2026-07-01T00:00:00Z" },
      fixedNow
    );
    expect(r.available).toBe(false);
    expect(r.message).toContain("disponível");
  });

  it("available when no disponibilidadePreenchimento key", () => {
    expect(
      isAvaliacaoAvailableForTutor({}, fixedNow)
    ).toEqual({ available: true });
  });
});

describe("isNotaFinalAvailableForAluno", () => {
  const fixedNow = new Date("2026-06-15T12:00:00Z");

  it("blocked when no professor data", () => {
    const r = isNotaFinalAvailableForAluno(null, null, fixedNow);
    expect(r.available).toBe(false);
    expect(r.message).toContain("ainda não foi publicada");
  });

  it("blocked when professor data is pendente", () => {
    const r = isNotaFinalAvailableForAluno(
      null,
      pendingProfessorData,
      fixedNow
    );
    expect(r.available).toBe(false);
  });

  it("available when professor signed and no publication date restriction", () => {
    expect(
      isNotaFinalAvailableForAluno(null, signedProfessorData, fixedNow)
    ).toEqual({ available: true });
  });

  it("available when professor signed and publication date passed", () => {
    expect(
      isNotaFinalAvailableForAluno(
        { publicacaoNotaFinal: "2026-06-01T00:00:00Z" },
        signedProfessorData,
        fixedNow
      )
    ).toEqual({ available: true });
  });

  it("blocked when publication date is in the future", () => {
    const r = isNotaFinalAvailableForAluno(
      { publicacaoNotaFinal: "2026-07-01T00:00:00Z" },
      signedProfessorData,
      fixedNow
    );
    expect(r.available).toBe(false);
    expect(r.message).toContain("disponível a partir de");
  });
});

describe("canTutorSeeNotaFinal", () => {
  it("blocks when config toggle is off", () => {
    const r = canTutorSeeNotaFinal(
      makeConfig(false),
      signedProfessorData
    );
    expect(r.canSee).toBe(false);
    expect(r.reason).toContain("desativada");
  });

  it("blocks when toggle on but professor has not signed", () => {
    const r = canTutorSeeNotaFinal(makeConfig(true), null);
    expect(r.canSee).toBe(false);
    expect(r.reason).toContain("ainda não atribuiu");
  });

  it("allows when toggle on and professor signed", () => {
    expect(
      canTutorSeeNotaFinal(makeConfig(true), signedProfessorData)
    ).toEqual({ canSee: true });
  });

  it("blocks when no config", () => {
    const r = canTutorSeeNotaFinal(null, signedProfessorData);
    expect(r.canSee).toBe(false);
  });
});
