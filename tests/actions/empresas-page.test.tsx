import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("lucide-react", () => ({
  Building2: () => <svg data-testid="building-icon" />,
  MapPin: () => <svg data-testid="map-pin-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  Search: () => <svg data-testid="search-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { EmpresasPage } from "@/components/empresas/empresas-page";

function findText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (el) =>
      (typeof el.children === "string" && el.children.includes(text)) ||
      (Array.isArray(el.children) && el.children.some((c) => typeof c === "string" && c.includes(text)))
  );
}

const mockEmpresas = [
  { id: "1", nome: "Empresa A", setor: "TI", localidade: "Porto", distrito: "Porto", ativa: true },
  { id: "2", nome: "Empresa B", setor: "Saúde", localidade: "Lisboa", distrito: "Lisboa", ativa: false },
  { id: "3", nome: "Empresa C", localidade: "Braga", distrito: "Braga", ativa: true },
];

describe("EmpresasPage", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ empresas: mockEmpresas }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state initially", () => {
    const renderer = TestRenderer.create(<EmpresasPage basePath="/professor" />);
    const matches = findText(renderer.root, "A carregar empresas...");
    expect(matches.length).toBe(1);
  });

  it("renders empresas after fetch", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasPage basePath="/professor" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const matches = findText(renderer!.root, "Empresa A");
    expect(matches.length).toBe(1);
    expect(findText(renderer!.root, "Empresa B").length).toBe(1);
  });

  it("filters empresas by search query", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasPage basePath="/professor" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const input = renderer!.root.findByProps({ placeholder: "Pesquisar empresas..." });
    await act(async () => {
      input.props.onChange({ target: { value: "Empresa A" } });
    });

    expect(findText(renderer!.root, "Empresa A").length).toBe(1);
    expect(findText(renderer!.root, "Empresa B").length).toBe(0);
  });

  it("shows empty state when no empresas match filter", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasPage basePath="/professor" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const input = renderer!.root.findByProps({ placeholder: "Pesquisar empresas..." });
    await act(async () => {
      input.props.onChange({ target: { value: "NaoExiste" } });
    });

    expect(findText(renderer!.root, "Nenhuma empresa encontrada.").length).toBe(1);
  });

  it("renders error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Erro ao carregar" }),
    } as Response);

    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasPage basePath="/professor" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Erro ao carregar").length).toBe(1);
  });

  it("shows archived label for inactive empresas", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasPage basePath="/professor" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Arquivada").length).toBe(1);
  });

  it("links to correct basePath", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasPage basePath="/school-admin" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const allLinks = renderer!.root.findAllByType("a");
    const empresaNovaLinks = allLinks.filter(
      (el) => el.props?.href === "/school-admin/empresas/nova"
    );
    expect(empresaNovaLinks.length).toBe(1);
    expect(findText(empresaNovaLinks[0], "Nova Empresa").length).toBe(1);
  });
});
