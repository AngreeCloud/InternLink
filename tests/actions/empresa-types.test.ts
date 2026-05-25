import { describe, expect, it } from "vitest";
import { buildEmpresaSnapshot } from "@/lib/types/empresa";

const baseEmpresa = {
  id: "emp1",
  schoolId: "schoolA",
  nome: "Empresa Teste",
  nomeNormalizado: "empresa teste",
  tutorIds: [],
  ativa: true,
  createdAt: { toMillis: () => 1000 } as unknown as FirebaseFirestore.Timestamp,
  updatedAt: { toMillis: () => 1000 } as unknown as FirebaseFirestore.Timestamp,
  createdBy: "user1",
  updatedBy: "user1",
};

describe("buildEmpresaSnapshot", () => {
  it("builds snapshot with all fields", () => {
    const result = buildEmpresaSnapshot({
      ...baseEmpresa,
      nif: "501234567",
      morada: "Rua X",
      codigoPostal: "4480-000",
      localidade: "Vila do Conde",
      emailGeral: "geral@empresa.pt",
      telefone: "252000000",
    });

    expect(result.nome).toBe("Empresa Teste");
    expect(result.nif).toBe("501234567");
    expect(result.morada).toBe("Rua X");
    expect(result.codigoPostal).toBe("4480-000");
    expect(result.localidade).toBe("Vila do Conde");
    expect(result.emailGeral).toBe("geral@empresa.pt");
    expect(result.telefone).toBe("252000000");
  });

  it("builds snapshot with minimal fields (only nome)", () => {
    const result = buildEmpresaSnapshot({
      ...baseEmpresa,
    });

    expect(result.nome).toBe("Empresa Teste");
    expect(result.nif).toBeUndefined();
    expect(result.morada).toBeUndefined();
    expect(result.codigoPostal).toBeUndefined();
    expect(result.localidade).toBeUndefined();
    expect(result.emailGeral).toBeUndefined();
    expect(result.telefone).toBeUndefined();
  });

  it("builds snapshot with partial fields", () => {
    const result = buildEmpresaSnapshot({
      ...baseEmpresa,
      nif: "501234567",
      localidade: "Porto",
    });

    expect(result.nome).toBe("Empresa Teste");
    expect(result.nif).toBe("501234567");
    expect(result.localidade).toBe("Porto");
    expect(result.morada).toBeUndefined();
    expect(result.telefone).toBeUndefined();
  });
});
