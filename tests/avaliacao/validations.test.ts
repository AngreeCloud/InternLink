import { describe, expect, it } from "vitest";
import {
  validateEscala,
  validateConfig,
  validateCoerenciaMatematica,
  validateNotasTutor,
  validateNotaFinal,
  calculateNotaFinal,
} from "@/lib/avaliacao/validations";
import type { AvaliacaoConfig } from "@/lib/avaliacao/types";

const makeConfig = (overrides: Partial<AvaliacaoConfig> = {}): AvaliacaoConfig => ({
  parametros: [
    { nome: "Pontualidade" },
    { nome: "Autonomia" },
    { nome: "Qualidade" },
    { nome: "Relacionamento" },
  ],
  escala: { min: 1, max: 5 },
  metodoCalculo: "soma",
  notaFinalEsperada: { min: 4, max: 20 },
  permitirTutorVerNotaFinal: false,
  ...overrides,
});

describe("validateEscala", () => {
  it("accepts valid scale", () => {
    expect(validateEscala({ min: 0, max: 20 })).toEqual({ valid: true });
  });

  it("rejects min >= max", () => {
    const r = validateEscala({ min: 5, max: 5 });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("mínimo");
  });

  it("rejects min > max", () => {
    const r = validateEscala({ min: 10, max: 5 });
    expect(r.valid).toBe(false);
  });
});

describe("validateCoerenciaMatematica", () => {
  describe("soma", () => {
    it("4 params 1-5 → max 20", () => {
      expect(
        validateCoerenciaMatematica(4, { min: 1, max: 5 }, "soma", { min: 4, max: 20 })
      ).toEqual({ valid: true });
    });

    it("3 params 0-20 → max 60", () => {
      expect(
        validateCoerenciaMatematica(3, { min: 0, max: 20 }, "soma", { min: 0, max: 60 })
      ).toEqual({ valid: true });
    });

    it("rejects 4 params 0-5 → expected final max 0-100", () => {
      const r = validateCoerenciaMatematica(4, { min: 0, max: 5 }, "soma", {
        min: 0,
        max: 100,
      });
      expect(r.valid).toBe(false);
      expect(r.error).toContain("20");
    });

    it("rejects mismatch in min", () => {
      const r = validateCoerenciaMatematica(4, { min: 1, max: 5 }, "soma", {
        min: 0,
        max: 20,
      });
      expect(r.valid).toBe(false);
      expect(r.error).toContain("4");
    });
  });

  describe("media", () => {
    it("param scale 0-20 must match final scale 0-20", () => {
      expect(
        validateCoerenciaMatematica(5, { min: 0, max: 20 }, "media", {
          min: 0,
          max: 20,
        })
      ).toEqual({ valid: true });
    });

    it("rejects param scale 1-5 != final scale 0-20", () => {
      const r = validateCoerenciaMatematica(4, { min: 1, max: 5 }, "media", {
        min: 0,
        max: 20,
      });
      expect(r.valid).toBe(false);
      expect(r.error).toContain("escala dos parâmetros");
    });

    it("rejects param scale 0-20 != final scale 0-100", () => {
      const r = validateCoerenciaMatematica(4, { min: 0, max: 20 }, "media", {
        min: 0,
        max: 100,
      });
      expect(r.valid).toBe(false);
    });

    it("rejects param scale min=1 max=20 != final min=0 max=20", () => {
      const r = validateCoerenciaMatematica(4, { min: 1, max: 20 }, "media", {
        min: 0,
        max: 20,
      });
      expect(r.valid).toBe(false);
    });
  });
});

describe("validateConfig", () => {
  it("accepts valid sum config: 4 params 1-5 → 4-20", () => {
    expect(validateConfig(makeConfig())).toEqual({ valid: true });
  });

  it("accepts valid average config: params 0-20 → final 0-20", () => {
    expect(
      validateConfig(
        makeConfig({
          escala: { min: 0, max: 20 },
          metodoCalculo: "media",
          notaFinalEsperada: { min: 0, max: 20 },
        })
      )
    ).toEqual({ valid: true });
  });

  it("rejects empty parameters", () => {
    const r = validateConfig(makeConfig({ parametros: [] }));
    expect(r.valid).toBe(false);
    expect(r.error).toContain("parâmetro");
  });

  it("rejects invalid method", () => {
    const r = validateConfig(
      makeConfig({ metodoCalculo: "maximo" as unknown as "soma" })
    );
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Método");
  });

  it("rejects scale min >= max", () => {
    const r = validateConfig(
      makeConfig({ escala: { min: 10, max: 5 } })
    );
    expect(r.valid).toBe(false);
  });

  it("rejects math-incoherent sum config", () => {
    const r = validateConfig(
      makeConfig({
        parametros: [
          { nome: "A" },
          { nome: "B" },
        ],
        escala: { min: 0, max: 5 },
        metodoCalculo: "soma",
        notaFinalEsperada: { min: 0, max: 20 },
      })
    );
    expect(r.valid).toBe(false);
  });
});

describe("validateNotasTutor", () => {
  const config = makeConfig();

  it("accepts valid scores", () => {
    const r = validateNotasTutor(
      {
        Pontualidade: 4,
        Autonomia: 5,
        Qualidade: 3,
        Relacionamento: 5,
      },
      config
    );
    expect(r).toEqual({ valid: true });
  });

  it("rejects out-of-range score", () => {
    const r = validateNotasTutor(
      {
        Pontualidade: 6,
        Autonomia: 5,
        Qualidade: 3,
        Relacionamento: 5,
      },
      config
    );
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Pontualidade");
  });

  it("rejects non-integer score", () => {
    const r = validateNotasTutor(
      {
        Pontualidade: 3.5,
        Autonomia: 5,
        Qualidade: 3,
        Relacionamento: 5,
      },
      config
    );
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Pontualidade");
  });

  it("rejects missing parameter", () => {
    const r = validateNotasTutor(
      { Pontualidade: 4, Autonomia: 5 },
      config
    );
    expect(r.valid).toBe(false);
  });
});

describe("validateNotaFinal", () => {
  const config = makeConfig();

  it("accepts valid final grade", () => {
    expect(validateNotaFinal(18, config)).toEqual({ valid: true });
  });

  it("rejects grade below min", () => {
    const r = validateNotaFinal(3, config);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("fora da escala");
  });

  it("rejects grade above max", () => {
    const r = validateNotaFinal(21, config);
    expect(r.valid).toBe(false);
  });

  it("rejects non-integer", () => {
    const r = validateNotaFinal(15.5, config);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("inteiro");
  });
});

describe("calculateNotaFinal", () => {
  it("soma: 4+3+5+4 = 16", () => {
    const config = makeConfig({
      parametros: [
        { nome: "A" },
        { nome: "B" },
        { nome: "C" },
        { nome: "D" },
      ],
    });
    expect(calculateNotaFinal({ A: 4, B: 3, C: 5, D: 4 }, config)).toBe(16);
  });

  it("media: (4+3+5+4)/4 = 4", () => {
    const config = makeConfig({
      parametros: [
        { nome: "A" },
        { nome: "B" },
        { nome: "C" },
        { nome: "D" },
      ],
      metodoCalculo: "media",
    });
    expect(calculateNotaFinal({ A: 4, B: 3, C: 5, D: 4 }, config)).toBe(4);
  });

  it("media rounds to nearest integer", () => {
    const config = makeConfig({
      parametros: [
        { nome: "A" },
        { nome: "B" },
        { nome: "C" },
      ],
      metodoCalculo: "media",
    });
    expect(calculateNotaFinal({ A: 4, B: 3, C: 4 }, config)).toBe(4);
    expect(calculateNotaFinal({ A: 4, B: 3, C: 3 }, config)).toBe(3);
  });

  it("missing param treated as 0", () => {
    const config = makeConfig({
      parametros: [{ nome: "A" }, { nome: "B" }],
    });
    expect(calculateNotaFinal({ A: 5 }, config)).toBe(5);
  });

  it("soma with min 0, max 20, 3 params → max 60", () => {
    const config = makeConfig({
      parametros: [{ nome: "X" }, { nome: "Y" }, { nome: "Z" }],
      escala: { min: 0, max: 20 },
      metodoCalculo: "soma",
      notaFinalEsperada: { min: 0, max: 60 },
    });
    expect(calculateNotaFinal({ X: 15, Y: 18, Z: 20 }, config)).toBe(53);
  });
});
