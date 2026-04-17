import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRouterReplace = vi.fn();
const mockRouter = { replace: mockRouterReplace };
const mockGetAuthRuntime = vi.fn();
const mockGetDbRuntime = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockUpdateDoc = vi.fn();
const mockServerTimestamp = vi.fn();
const mockGetAccountStatusApprovalMessage = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => mockRouter,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
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

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: () => <img alt="school" />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/auth/school-selector", () => ({
  SchoolSelector: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select value={value} onChange={(event) => onChange(event.target.value)} data-testid="school-selector">
      <option value="">Selecionar escola</option>
      <option value="schoolA">Escola A</option>
      <option value="schoolB">Escola B</option>
    </select>
  ),
}));

vi.mock("@/lib/approval-messages", () => ({
  getAccountStatusApprovalMessage: (...args: unknown[]) => mockGetAccountStatusApprovalMessage(...args),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AccountStatusPage from "@/app/account-status/page";

function makeUsersSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
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
  mockGetAuthRuntime.mockResolvedValue({ app: "auth" });
  mockGetDbRuntime.mockResolvedValue({ app: "db" });
  mockCollection.mockReturnValue({ path: "schools" });
  mockDoc.mockReturnValue({ path: "users/uid-1" });
  mockQuery.mockImplementation((...parts: unknown[]) => ({ parts }));
  mockWhere.mockImplementation((field: string, op: string, value: unknown) => ({ field, op, value }));
  mockServerTimestamp.mockReturnValue("mock-ts");
  mockUpdateDoc.mockResolvedValue(undefined);
  mockGetDocs.mockResolvedValue({
    docs: [
      {
        id: "schoolB",
        data: () => ({
          name: "Escola B",
          profileImageUrl: "",
          emailDomain: "",
          requireInstitutionalEmail: false,
          allowGoogleLogin: true,
          requiresPhone: false,
        }),
      },
      {
        id: "courseB",
        data: () => ({
          name: "Eletrónica B",
        }),
      },
    ],
  });
  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
    void cb({ uid: "uid-1", email: "student@example.com", metadata: { creationTime: "2026-01-01T00:00:00.000Z" } });
    return vi.fn();
  });
  mockGetAccountStatusApprovalMessage.mockImplementation((role?: string, estado?: string) => {
    if (role === "tutor" && estado === "inativo") {
      return "A conta de tutor está inativa. Verifique o email e volte a iniciar sessão.";
    }
    return "A sua conta está pendente de aprovação manual pelo administrador escolar da sua escola.";
  });
});

function renderText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (node === null) return "";
  if (Array.isArray(node)) return node.map((child) => renderText(child)).join(" ");

  const children = node.children ?? [];
  return children
    .map((child) => (typeof child === "string" ? child : renderText(child)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("AccountStatusPage integration", () => {
  it("redirects approved student directly to dashboard", async () => {
    mockGetDoc.mockResolvedValueOnce(makeUsersSnapshot({ role: "aluno", estado: "ativo" }));

    await act(async () => {
      TestRenderer.create(<AccountStatusPage />);
    });

    await flush();

    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects approved professor directly to professor area", async () => {
    mockGetDoc.mockResolvedValueOnce(makeUsersSnapshot({ role: "professor", estado: "ativo" }));

    await act(async () => {
      TestRenderer.create(<AccountStatusPage />);
    });

    await flush();

    expect(mockRouterReplace).toHaveBeenCalledWith("/professor");
  });

  it("keeps pending student on waiting/account-status flow", async () => {
    mockGetDoc.mockResolvedValueOnce(makeUsersSnapshot({ role: "aluno", estado: "pendente" }));

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<AccountStatusPage />);
    });

    await flush();

    expect(mockRouterReplace).not.toHaveBeenCalledWith("/dashboard");
    expect(mockRouterReplace).not.toHaveBeenCalledWith("/professor");
    expect(mockRouterReplace).not.toHaveBeenCalledWith("/tutor");
    expect(mockRouterReplace).not.toHaveBeenCalledWith("/school-admin");

    const links = tree!.root.findAllByType("a").map((node) => String(node.props.href));
    expect(links).not.toContain("/verify-email");
  });

  it("shows tutor-specific inactive message and never school-approval wording", async () => {
    mockGetDoc.mockResolvedValueOnce(makeUsersSnapshot({ role: "tutor", estado: "inativo" }));

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<AccountStatusPage />);
    });

    await flush();

    expect(mockRouterReplace).not.toHaveBeenCalledWith("/tutor");
    expect(mockGetAccountStatusApprovalMessage).toHaveBeenCalledWith("tutor", "inativo");

    const text = renderText(tree!.toJSON());
    const links = tree!.root.findAllByType("a").map((node) => String(node.props.href));
    expect(text).toContain("A conta de tutor está inativa. Verifique o email e volte a iniciar sessão.");
    expect(text).not.toContain("pendente de aprovação manual pelo administrador escolar da sua escola");
    expect(links).toContain("/verify-email");
  });

  it("permite re-solicitar acesso para aluno inativo com escola e turma", async () => {
    mockGetDoc.mockResolvedValueOnce(
      makeUsersSnapshot({
        role: "aluno",
        estado: "inativo",
        schoolId: "schoolA",
        courseId: "courseA",
        curso: "Informática A",
      })
    );

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<AccountStatusPage />);
    });

    await flush();

    const root = tree!.root as any;
    const schoolSelector = root.findByProps({ "data-testid": "school-selector" });
    await act(async () => {
      schoolSelector.props.onChange({ target: { value: "schoolB" } });
    });
    await flush();

    const selects = root.findAllByType("select");
    const courseSelect = selects.find((node: { props: { className?: string } }) =>
      String(node.props.className || "").includes("h-9 w-full rounded-md")
    );

    await act(async () => {
      courseSelect.props.onChange({ target: { value: "courseB" } });
    });
    await flush();

    const actionButtons = root.findAllByType("button");
    const reRequestButton = actionButtons.find(
      (button: { children?: unknown[] }) => Array.isArray(button.children) && button.children.join("") === "Re-solicitar acesso"
    );

    await act(async () => {
      reRequestButton.props.onClick();
    });
    await flush();

    expect(mockUpdateDoc).toHaveBeenCalled();
    const payload = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      schoolId: "schoolB",
      courseId: "courseB",
      curso: "Eletrónica B",
      estado: "pendente",
      updatedAt: "mock-ts",
    });
  });
});