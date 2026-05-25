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

describe("estagio empresaId consistency", () => {
  it("buildEmpresaSnapshot includes all fields needed for estagio snapshot", () => {
    const snapshot = buildEmpresaSnapshot({
      ...baseEmpresa,
      nif: "501234567",
      morada: "Rua X",
      codigoPostal: "4480-000",
      localidade: "Vila do Conde",
      emailGeral: "geral@empresa.pt",
      telefone: "252000000",
    });

    expect(snapshot).toEqual({
      nome: "Empresa Teste",
      nif: "501234567",
      morada: "Rua X",
      codigoPostal: "4480-000",
      localidade: "Vila do Conde",
      emailGeral: "geral@empresa.pt",
      telefone: "252000000",
    });
  });

  it("replacing empresaId regenerates snapshot with new empresa data", () => {
    const oldEmpresa = {
      ...baseEmpresa,
      nome: "Empresa Antiga",
      nif: "501234567",
      morada: "Rua Antiga",
    };
    const newEmpresa = {
      ...baseEmpresa,
      id: "emp2",
      nome: "Empresa Nova",
      nif: "987654321",
      morada: "Rua Nova",
      localidade: "Porto",
    };

    const oldSnapshot = buildEmpresaSnapshot(oldEmpresa);
    const newSnapshot = buildEmpresaSnapshot(newEmpresa);

    expect(oldSnapshot.nome).toBe("Empresa Antiga");
    expect(newSnapshot.nome).toBe("Empresa Nova");
    expect(oldSnapshot.nif).toBe("501234567");
    expect(newSnapshot.nif).toBe("987654321");
    expect(newSnapshot.morada).toBe("Rua Nova");
    expect(newSnapshot.localidade).toBe("Porto");
  });

  it("patching empresaId=null keeps snapshot unchanged (historical)", () => {
    const empresa = {
      ...baseEmpresa,
      nome: "Empresa Original",
      nif: "501234567",
    };
    const snapshot = buildEmpresaSnapshot(empresa);

    expect(snapshot.nome).toBe("Empresa Original");
    expect(snapshot.nif).toBe("501234567");
  });
});
