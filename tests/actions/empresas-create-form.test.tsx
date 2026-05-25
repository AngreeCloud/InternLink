import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, disabled, ...props }: { children: React.ReactNode; disabled?: boolean }) => (
    <button disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: { children: React.ReactNode }) => <label {...props}>{children}</label>,
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}));

import { EmpresasCreateForm } from "@/components/empresas/empresas-create-form";

function findText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (el) =>
      (typeof el.children === "string" && el.children.includes(text)) ||
      (Array.isArray(el.children) && el.children.some((c) => typeof c === "string" && c.includes(text)))
  );
}

describe("EmpresasCreateForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: "new-1" }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders form with all sections", () => {
    const renderer = TestRenderer.create(<EmpresasCreateForm basePath="/professor" />);
    expect(findText(renderer.root, "Nova Empresa").length).toBe(1);
    expect(findText(renderer.root, "Identificação").length).toBe(1);
    expect(findText(renderer.root, "Localização").length).toBe(1);
    expect(findText(renderer.root, "Contacto").length).toBe(1);
  });

  it("shows validation error when nome is empty on submit", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasCreateForm basePath="/professor" />);
    });

    const form = renderer!.root.findByType("form");
    await act(async () => {
      form.props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(findText(renderer!.root, "O nome da empresa é obrigatório.").length).toBe(1);
  });

  it("submits form successfully and redirects", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasCreateForm basePath="/professor" />);
    });

    const nomeInput = renderer!.root.findByProps({ id: "nome" });
    await act(async () => {
      nomeInput.props.onChange({ target: { value: "Nova Empresa" } });
    });

    const form = renderer!.root.findByType("form");
    await act(async () => {
      form.props.onSubmit({ preventDefault: vi.fn() });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/empresas", expect.objectContaining({
      method: "POST",
    }));
    expect(mockPush).toHaveBeenCalledWith("/professor/empresas/new-1");
  });

  it("shows error when API returns error", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Já existe uma empresa com este nome" }),
    } as Response);

    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasCreateForm basePath="/professor" />);
    });

    const nomeInput = renderer!.root.findByProps({ id: "nome" });
    await act(async () => {
      nomeInput.props.onChange({ target: { value: "Empresa Duplicada" } });
    });

    const form = renderer!.root.findByType("form");
    await act(async () => {
      form.props.onSubmit({ preventDefault: vi.fn() });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Já existe uma empresa com este nome").length).toBe(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error on network failure", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Erro de rede"));

    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EmpresasCreateForm basePath="/professor" />);
    });

    const nomeInput = renderer!.root.findByProps({ id: "nome" });
    await act(async () => {
      nomeInput.props.onChange({ target: { value: "Empresa" } });
    });

    const form = renderer!.root.findByType("form");
    await act(async () => {
      form.props.onSubmit({ preventDefault: vi.fn() });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(findText(renderer!.root, "Erro de rede").length).toBe(1);
  });
});
