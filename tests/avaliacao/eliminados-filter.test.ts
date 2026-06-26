import { describe, expect, it } from "vitest";

type EstagioLike = {
  id: string;
  estado: string;
  titulo: string;
  professorId: string;
};

function filterDisplayEstagios(
  estagios: EstagioLike[],
  showOnlyMy: boolean,
  userId: string
): EstagioLike[] {
  const active = estagios.filter((e) => e.estado !== "eliminado");
  if (!showOnlyMy || !userId) return active;
  return active.filter((e) => e.professorId === userId);
}

function filterAdminEstagios(estagios: EstagioLike[]): EstagioLike[] {
  return estagios.filter((e) => e.estado !== "eliminado");
}

const makeEstagio = (
  id: string,
  estado: string,
  professorId = "prof1"
): EstagioLike => ({
  id,
  estado,
  titulo: `Estágio ${id}`,
  professorId,
});

describe("filterDisplayEstagios (professor)", () => {
  const userId = "prof1";

  it("exclui estágios eliminados", () => {
    const list = [
      makeEstagio("1", "ativo"),
      makeEstagio("2", "eliminado"),
      makeEstagio("3", "concluido"),
    ];
    const result = filterDisplayEstagios(list, false, userId);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("exclui eliminados + filtra por professorId se showOnlyMy", () => {
    const list = [
      makeEstagio("1", "ativo", "prof1"),
      makeEstagio("2", "ativo", "prof2"),
      makeEstagio("3", "eliminado", "prof1"),
      makeEstagio("4", "concluido", "prof1"),
    ];
    const result = filterDisplayEstagios(list, true, userId);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["1", "4"]);
  });

  it("showOnlyMy=false retorna todos ativos independentemente do professor", () => {
    const list = [
      makeEstagio("1", "ativo", "prof1"),
      makeEstagio("2", "ativo", "prof2"),
      makeEstagio("3", "eliminado", "prof1"),
    ];
    const result = filterDisplayEstagios(list, false, userId);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("lista vazia retorna vazia", () => {
    expect(filterDisplayEstagios([], false, userId)).toEqual([]);
  });

  it("todos eliminados retorna vazia", () => {
    const list = [
      makeEstagio("1", "eliminado"),
      makeEstagio("2", "eliminado"),
    ];
    expect(filterDisplayEstagios(list, false, userId)).toEqual([]);
  });

  it("estado 'eliminado' com espaços extra não é filtrado (comparação exata)", () => {
    const list = [
      makeEstagio("1", "ativo"),
      makeEstagio("2", " eliminado"),
    ];
    // " eliminado" !== "eliminado" — comparação exata, não filtra
    const result = filterDisplayEstagios(list, false, userId);
    expect(result).toHaveLength(2);
  });

  it("estágios sem estado 'ativo' default não são filtrados", () => {
    const list = [
      { id: "1", estado: "ativo", titulo: "E1", professorId: "prof1" },
    ];
    const result = filterDisplayEstagios(list, false, userId);
    expect(result).toHaveLength(1);
  });
});

describe("filterAdminEstagios (school-admin)", () => {
  it("exclui eliminados da tabela admin", () => {
    const list = [
      makeEstagio("1", "ativo"),
      makeEstagio("2", "eliminado"),
      makeEstagio("3", "concluido"),
      makeEstagio("4", "eliminado"),
    ];
    expect(filterAdminEstagios(list)).toHaveLength(2);
  });

  it("mantém todos se nenhum eliminado", () => {
    const list = [
      makeEstagio("1", "ativo"),
      makeEstagio("2", "concluido"),
      makeEstagio("3", "pendente"),
    ];
    expect(filterAdminEstagios(list)).toHaveLength(3);
  });

  it("todos eliminados retorna vazia", () => {
    const list = [
      makeEstagio("1", "eliminado"),
      makeEstagio("2", "eliminado"),
    ];
    expect(filterAdminEstagios(list)).toEqual([]);
  });
});

describe("consistência entre professor e admin", () => {
  const userId = "prof1";
  const list = [
    makeEstagio("1", "ativo"),
    makeEstagio("2", "eliminado"),
    makeEstagio("3", "concluido"),
  ];

  it("ambos excluem o mesmo eliminado", () => {
    const prof = filterDisplayEstagios(list, false, userId);
    const admin = filterAdminEstagios(list);
    expect(prof).toHaveLength(2);
    expect(admin).toHaveLength(2);
    expect(prof.map((e) => e.id)).toEqual(admin.map((e) => e.id));
  });
});
