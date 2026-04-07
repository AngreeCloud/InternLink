import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePathname = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouter = { replace: mockRouterReplace };
const mockGetAuthRuntime = vi.fn();
const mockGetDbRuntime = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockChatBadge = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockRouter,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
  getDbRuntime: (...args: unknown[]) => mockGetDbRuntime(...args),
}));

vi.mock("@/components/chat/chat-nav-unread-badge", () => ({
  ChatNavUnreadBadge: (props: { userId: string; isActive?: boolean }) => {
    mockChatBadge(props);
    return <span data-testid="chat-badge" data-user={props.userId} data-active={String(Boolean(props.isActive))} />;
  },
}));

vi.mock("@/components/school-admin/school-admin-context", () => ({
  SchoolAdminProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/school-admin/school-admin-approvals-badge", () => ({
  SchoolAdminApprovalsBadge: () => <span data-testid="approvals-badge" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: () => <img alt="avatar" />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    GraduationCap: Icon,
    Home: Icon,
    Info: Icon,
    CheckSquare: Icon,
    MessageSquare: Icon,
    History: Icon,
    Folder: Icon,
    LogOut: Icon,
    Menu: Icon,
  };
});

import { SchoolAdminLayout } from "../../components/layout/school-admin-layout";

function makeUserSnap(data: Record<string, unknown>) {
  return {
    exists: () => true,
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

  mockUsePathname.mockReturnValue("/school-admin/chat");
  mockGetAuthRuntime.mockResolvedValue({ app: "auth" });
  mockGetDbRuntime.mockResolvedValue({ app: "db" });
  mockDoc.mockReturnValue({ path: "users/adminA" });
  mockGetDoc.mockResolvedValue(
    makeUserSnap({
      role: "admin_escolar",
      schoolId: "schoolA",
      nome: "Admin A",
      email: "admin@school.pt",
      photoURL: "",
    })
  );

  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
    void cb({ uid: "adminA", displayName: "Admin A", email: "admin@school.pt" });
    return vi.fn();
  });
});

describe("SchoolAdminLayout integration", () => {
  it("mounts chat badge in desktop and mobile chat nav items", async () => {
    await act(async () => {
      TestRenderer.create(
        <SchoolAdminLayout>
          <div>Conteudo</div>
        </SchoolAdminLayout>
      );
    });

    await flush();

    expect(mockChatBadge).toHaveBeenCalledTimes(2);

    const calls = mockChatBadge.mock.calls.map((args) => args[0] as { userId: string; isActive?: boolean });
    for (const props of calls) {
      expect(props.userId).toBe("adminA");
      expect(props.isActive).toBe(true);
    }
  });

  it("passes inactive state when route is not chat", async () => {
    mockUsePathname.mockReturnValue("/school-admin/historico");

    await act(async () => {
      TestRenderer.create(
        <SchoolAdminLayout>
          <div>Conteudo</div>
        </SchoolAdminLayout>
      );
    });

    await flush();

    expect(mockChatBadge).toHaveBeenCalledTimes(2);
    const calls = mockChatBadge.mock.calls.map((args) => args[0] as { isActive?: boolean });
    for (const props of calls) {
      expect(props.isActive).toBe(false);
    }
  });

  it("does not mount chat badge when user is not school admin", async () => {
    mockGetDoc.mockResolvedValue(
      makeUserSnap({
        role: "professor",
        schoolId: "schoolA",
      })
    );

    await act(async () => {
      TestRenderer.create(
        <SchoolAdminLayout>
          <div>Conteudo</div>
        </SchoolAdminLayout>
      );
    });

    await flush();

    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
    expect(mockChatBadge).not.toHaveBeenCalled();
  });
});
