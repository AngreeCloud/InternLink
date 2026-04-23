import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthRuntime = vi.fn();
const mockGetDbRuntime = vi.fn();
const mockOnAuthStateChanged = vi.fn();

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockServerTimestamp = vi.fn();
const mockUpdateDoc = vi.fn();
const mockWhere = vi.fn();

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
  getDbRuntime: (...args: unknown[]) => mockGetDbRuntime(...args),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    Search: Icon,
    Users: Icon,
  };
});

import { ApprovedStudentsManager } from "@/components/professor/approved-students-manager";

function makeDocSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

function makeQuerySnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { docs };
}

function makeQueryDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mockGetAuthRuntime.mockResolvedValue({ currentUser: { uid: "prof-1" } });
  mockGetDbRuntime.mockResolvedValue({ app: "db" });

  mockCollection.mockImplementation((_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }));
  mockDoc.mockImplementation((_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }));
  mockWhere.mockImplementation((field: string, op: string, value: unknown) => ({ field, op, value }));
  mockQuery.mockImplementation((...parts: unknown[]) => ({ parts }));
  mockServerTimestamp.mockReturnValue("mock-server-ts");
  mockUpdateDoc.mockResolvedValue(undefined);

  mockGetDoc.mockResolvedValue(
    makeDocSnapshot({
      schoolId: "school-1",
      escola: "Escola Teste",
    })
  );

  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: { uid: string }) => void) => {
    cb({ uid: "prof-1" });
    return vi.fn();
  });
});

describe("ApprovedStudentsManager integration", () => {
  it("renderiza tabela view-only e mostra os 3 estados de estágio", async () => {
    mockGetDocs
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("c1", { name: "Turma A" }),
          makeQueryDoc("c2", { name: "Turma B" }),
        ])
      )
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("s1", {
            nome: "Ana Silva",
            email: "ana@escola.pt",
            courseId: "c1",
            curso: "Turma A",
            localidade: "Porto",
            telefone: "911111111",
            dataNascimento: "2007-01-01",
            createdAt: { toDate: () => new Date("2025-01-10T00:00:00Z") },
          }),
          makeQueryDoc("s2", {
            nome: "Bruno Costa",
            email: "bruno@escola.pt",
            courseId: "c2",
            curso: "Turma B",
            localidade: "Lisboa",
            telefone: "922222222",
            dataNascimento: "2006-02-01",
            createdAt: { toDate: () => new Date("2025-01-11T00:00:00Z") },
          }),
          makeQueryDoc("s3", {
            nome: "Carla Pinto",
            email: "carla@escola.pt",
            courseId: "c2",
            curso: "Turma B",
            localidade: "Coimbra",
            telefone: "933333333",
            dataNascimento: "2005-03-01",
            createdAt: { toDate: () => new Date("2025-01-12T00:00:00Z") },
          }),
        ])
      )
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("e1", { alunoId: "s1", estado: "ativo" }),
          makeQueryDoc("e2", { alunoId: "s2", estado: "concluido" }),
        ])
      );

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ApprovedStudentsManager />);
    });
    await flush();

    const root = renderer.root as any;

    expect(root.findAllByType("select").length).toBe(0);
    expect(root.findByProps({ "data-testid": "open-change-course-dialog" })).toBeTruthy();
    expect(root.findByProps({ "data-testid": "open-remove-student-dialog" })).toBeTruthy();

    const statusTexts = root.findAll(
      (node: { type: unknown; children?: unknown[] }) =>
        node.type === "span"
        && Array.isArray(node.children)
        && (
          node.children.join("").includes("Estágio ativo")
          || node.children.join("").includes("Estágio concluido")
          || node.children.join("").includes("Sem estágio associado")
        )
    );
    expect(statusTexts.length).toBeGreaterThanOrEqual(3);

    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(root.findAllByProps({ "data-testid": "dialog-root" }).length).toBe(0);
  });

  it("troca turma por popup com pesquisa de aluno", async () => {
    mockGetDocs
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("c1", { name: "Turma A" }),
          makeQueryDoc("c2", { name: "Turma B" }),
        ])
      )
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("s1", {
            nome: "Ana Silva",
            email: "ana@escola.pt",
            courseId: "c1",
            curso: "Turma A",
            localidade: "Porto",
            telefone: "911111111",
            dataNascimento: "2007-01-01",
            createdAt: { toDate: () => new Date("2025-01-10T00:00:00Z") },
          }),
        ])
      )
      .mockResolvedValueOnce(makeQuerySnapshot([]));

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ApprovedStudentsManager />);
    });
    await flush();

    const root = renderer.root as any;

    const openDialogButton = root.findByProps({ "data-testid": "open-change-course-dialog" });
    await act(async () => {
      openDialogButton.props.onClick();
    });
    await flush();

    const searchInput = root.findByProps({ "data-testid": "manage-student-search" });
    await act(async () => {
      searchInput.props.onChange({ target: { value: "ana" } });
    });
    await flush();

    const selectStudentButton = root.findByProps({ "data-testid": "select-student-s1" });
    await act(async () => {
      selectStudentButton.props.onClick();
    });
    await flush();

    const courseSelect = root.findByProps({ "data-testid": "dialog-course-select" });
    await act(async () => {
      courseSelect.props.onChange({ target: { value: "c2" } });
    });
    await flush();

    const confirmButton = root.findByProps({ "data-testid": "manage-student-confirm" });
    await act(async () => {
      confirmButton.props.onClick();
    });
    await flush();

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      courseId: "c2",
      curso: "Turma B",
      updatedAt: "mock-server-ts",
    });

    const successMessages = root.findAll(
      (node: { type: unknown; children?: unknown[] }) =>
        node.type === "p"
        && Array.isArray(node.children)
        && node.children.join("").includes("Turma de Ana Silva atualizada para Turma B.")
    );
    expect(successMessages.length).toBeGreaterThan(0);

    expect(root.findAllByProps({ "data-testid": "dialog-root" }).length).toBe(0);
  });

  it("remove aluno por popup", async () => {
    mockGetDocs
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("c1", { name: "Turma A" }),
          makeQueryDoc("c2", { name: "Turma B" }),
        ])
      )
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          makeQueryDoc("s1", {
            nome: "Ana Silva",
            email: "ana@escola.pt",
            courseId: "c1",
            curso: "Turma A",
            localidade: "Porto",
            telefone: "911111111",
            dataNascimento: "2007-01-01",
            createdAt: { toDate: () => new Date("2025-01-10T00:00:00Z") },
          }),
        ])
      )
      .mockResolvedValueOnce(makeQuerySnapshot([]));

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ApprovedStudentsManager />);
    });
    await flush();

    const root = renderer.root as any;

    const openDialogButton = root.findByProps({ "data-testid": "open-remove-student-dialog" });
    await act(async () => {
      openDialogButton.props.onClick();
    });
    await flush();

    const selectStudentButton = root.findByProps({ "data-testid": "select-student-s1" });
    await act(async () => {
      selectStudentButton.props.onClick();
    });
    await flush();

    const confirmButton = root.findByProps({ "data-testid": "manage-student-confirm" });
    await act(async () => {
      confirmButton.props.onClick();
    });
    await flush();

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      estado: "inativo",
      updatedAt: "mock-server-ts",
    });

    const successMessages = root.findAll(
      (node: { type: unknown; children?: unknown[] }) =>
        node.type === "p"
        && Array.isArray(node.children)
        && node.children.join("").includes("Aluno Ana Silva marcado como inativo com sucesso.")
    );
    expect(successMessages.length).toBeGreaterThan(0);
  });
});
