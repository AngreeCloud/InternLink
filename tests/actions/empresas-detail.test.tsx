import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
  Building2: () => <svg data-testid="building-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

import { EmpresasDetail } from "@/components/empresas/empresas-detail";

function findText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (el) =>
      (typeof el.children === "string" && el.children.includes(text)) ||
      (Array.isArray(el.children) && el.children.some((c) => typeof c === "string" && c.includes(text)))
  );
}

const mockEmpresa = {
  id: "1",
  nome: "Empresa Teste",
  nif: "501234567",
  setor: "TI",
  website: "https://empresa.pt",
  descricao: "Descrição da empresa",
  morada: "Rua X",
  codigoPostal: "4480-000",
  localidade: "Vila do Conde",
  concelho: "Vila do Conde",
  distrito: "Porto",
  pais: "Portugal",
  emailGeral: "geral@empresa.pt",
  telefone: "252000000",
  ativa: true,
};

describe("EmpresasDetail", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ empresa: mockEmpresa }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state initially", () => {
    const renderer = TestRenderer.create(
      <EmpresasDetail empresaId="1" basePath="/professor" />
    );
    const loaders = renderer.root.findAllByProps({ "data-testid": "loader-icon" });
    expect(loaders.length).toBe(1);
  });

  it("renders empresa details after fetch", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EmpresasDetail empresaId="1" basePath="/professor" />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Empresa Teste").length).toBe(1);
    expect(findText(renderer!.root, "geral@empresa.pt").length).toBe(1);
    expect(findText(renderer!.root, "252000000").length).toBe(1);
    expect(findText(renderer!.root, "501234567").length).toBe(1);
    expect(findText(renderer!.root, "https://empresa.pt").length).toBe(1);
    expect(findText(renderer!.root, "Descrição da empresa").length).toBe(1);
  });

  it("shows error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Erro ao carregar empresa" }),
    } as Response);

    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EmpresasDetail empresaId="1" basePath="/professor" />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Erro ao carregar empresa").length).toBe(1);
  });

  it("shows 404 message when empresa not found", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Empresa não encontrada" }),
    } as Response);

    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EmpresasDetail empresaId="999" basePath="/professor" />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Empresa não encontrada").length).toBe(1);
  });

  it("shows archived indicator when empresa is inactive", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ empresa: { ...mockEmpresa, ativa: false } }),
    } as Response);

    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EmpresasDetail empresaId="1" basePath="/professor" />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Empresa arquivada.").length).toBe(1);
  });
});
