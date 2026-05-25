import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: { children: React.ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

import { EmpresasEditForm } from "@/components/empresas/empresas-edit-form";

function findText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (el) =>
      (typeof el.children === "string" && el.children.includes(text)) ||
      (Array.isArray(el.children) && el.children.some((c) => typeof c === "string" && c.includes(text)))
  );
}

const fakeEmpresa = {
  nome: "Empresa Teste",
  nif: "501234567",
  setor: "Tecnologia",
  website: "https://teste.pt",
  descricao: "Uma empresa de teste",
  morada: "Rua Teste, 123",
  codigoPostal: "4480-001",
  localidade: "Vila do Conde",
  concelho: "Vila do Conde",
  distrito: "Porto",
  pais: "Portugal",
  emailGeral: "geral@teste.pt",
  telefone: "252000000",
};

describe("EmpresasEditForm", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  it("renders title, save and cancel buttons", () => {
    const c = TestRenderer.create(
      <EmpresasEditForm
        empresaId="emp-123"
        initial={fakeEmpresa}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(findText(c.root, "Editar Empresa").length).toBe(1);
    expect(findText(c.root, "Guardar Alterações").length).toBe(1);
    expect(findText(c.root, "Cancelar").length).toBe(1);
  });

  it("shows error when nome is empty on submit", async () => {
    const c = TestRenderer.create(
      <EmpresasEditForm
        empresaId="emp-123"
        initial={{ ...fakeEmpresa, nome: "" }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const form = c.root.findByType("form");
    await act(async () => {
      await form.props.onSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(findText(c.root, "O nome da empresa é obrigatório.").length).toBe(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("submits PATCH request and calls onSaved", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const onSaved = vi.fn();
    const c = TestRenderer.create(
      <EmpresasEditForm
        empresaId="emp-123"
        initial={fakeEmpresa}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />
    );

    const form = c.root.findByType("form");
    await act(async () => {
      await form.props.onSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/empresas/emp-123",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("shows API error on failure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Sem permissão" }),
    });

    const c = TestRenderer.create(
      <EmpresasEditForm
        empresaId="emp-123"
        initial={fakeEmpresa}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const form = c.root.findByType("form");
    await act(async () => {
      await form.props.onSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(findText(c.root, "Sem permissão").length).toBe(1);
  });

  it("shows error message on network failure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );

    const c = TestRenderer.create(
      <EmpresasEditForm
        empresaId="emp-123"
        initial={fakeEmpresa}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const form = c.root.findByType("form");
    await act(async () => {
      await form.props.onSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(findText(c.root, "Network error").length).toBe(1);
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    const c = TestRenderer.create(
      <EmpresasEditForm
        empresaId="emp-123"
        initial={fakeEmpresa}
        onSaved={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelBtn = c.root.findAllByType("button").find(
      (btn) => {
        if (typeof btn.children === "string") return btn.children === "Cancelar";
        if (Array.isArray(btn.children)) return btn.children.includes("Cancelar");
        return false;
      }
    );

    expect(cancelBtn).toBeDefined();
    cancelBtn!.props.onClick();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
