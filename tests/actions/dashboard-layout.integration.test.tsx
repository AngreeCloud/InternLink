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
const mockUseChatNotifications = vi.fn();

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

vi.mock("@/lib/chat/use-chat-notifications", () => ({
  useChatNotifications: (args: unknown) => {
    mockUseChatNotifications(args);
    return {
      notifications: [],
      dismissNotification: vi.fn(),
      handleOpenConversation: vi.fn(),
    };
  },
}));

vi.mock("@/components/chat/notifications-inbox", () => ({
  NotificationsInbox: () => <span data-testid="notifications-inbox" />,
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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    GraduationCap: Icon,
    Home: Icon,
    FileText: Icon,
    Upload: Icon,
    MessageSquare: Icon,
    LogOut: Icon,
    Menu: Icon,
    User: Icon,
  };
});

import { DashboardLayout } from "../../components/layout/dashboard-layout";

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

  mockUsePathname.mockReturnValue("/dashboard/chat");
  mockGetAuthRuntime.mockResolvedValue({ app: "auth" });
  mockGetDbRuntime.mockResolvedValue({ app: "db" });
  mockDoc.mockReturnValue({ path: "users/alunoA" });
  mockGetDoc.mockResolvedValue(
    makeUserSnap({
      role: "aluno",
      estado: "ativo",
      nome: "Aluno A",
      email: "aluno@school.pt",
      photoURL: "",
    })
  );

  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
    void cb({ uid: "alunoA", displayName: "Aluno A", email: "aluno@school.pt" });
    return vi.fn();
  });
});

describe("DashboardLayout integration", () => {
  it("ativa notificações fora da rota de chat", async () => {
    mockUsePathname.mockReturnValue("/dashboard/reports");

    await act(async () => {
      TestRenderer.create(
        <DashboardLayout>
          <div>Conteudo</div>
        </DashboardLayout>
      );
    });

    await flush();

    const lastCallIndex = mockUseChatNotifications.mock.calls.length - 1;
    const props = mockUseChatNotifications.mock.calls[lastCallIndex]?.[0] as {
      enabled: boolean;
      isChatOpen: boolean;
    };
    expect(props.enabled).toBe(true);
    expect(props.isChatOpen).toBe(false);
  });

  it("desativa notificações na rota de chat", async () => {
    mockUsePathname.mockReturnValue("/dashboard/chat");

    await act(async () => {
      TestRenderer.create(
        <DashboardLayout>
          <div>Conteudo</div>
        </DashboardLayout>
      );
    });

    await flush();

    const lastCallIndex = mockUseChatNotifications.mock.calls.length - 1;
    const props = mockUseChatNotifications.mock.calls[lastCallIndex]?.[0] as {
      enabled: boolean;
      isChatOpen: boolean;
    };
    expect(props.enabled).toBe(false);
    expect(props.isChatOpen).toBe(true);
  });

  it("mounts chat badge in desktop and mobile chat nav items", async () => {
    await act(async () => {
      TestRenderer.create(
        <DashboardLayout>
          <div>Conteudo</div>
        </DashboardLayout>
      );
    });

    await flush();

    expect(mockChatBadge).toHaveBeenCalledTimes(2);

    const calls = mockChatBadge.mock.calls.map((args) => args[0] as { userId: string; isActive?: boolean });
    for (const props of calls) {
      expect(props.userId).toBe("alunoA");
      expect(props.isActive).toBe(true);
    }
  });

  it("passes inactive state when route is not chat", async () => {
    mockUsePathname.mockReturnValue("/dashboard/reports");

    await act(async () => {
      TestRenderer.create(
        <DashboardLayout>
          <div>Conteudo</div>
        </DashboardLayout>
      );
    });

    await flush();

    expect(mockChatBadge).toHaveBeenCalledTimes(2);
    const calls = mockChatBadge.mock.calls.map((args) => args[0] as { isActive?: boolean });
    for (const props of calls) {
      expect(props.isActive).toBe(false);
    }
  });

  it("does not mount chat badge when user role is not student", async () => {
    mockGetDoc.mockResolvedValue(
      makeUserSnap({
        role: "professor",
        estado: "ativo",
      })
    );

    await act(async () => {
      TestRenderer.create(
        <DashboardLayout>
          <div>Conteudo</div>
        </DashboardLayout>
      );
    });

    await flush();

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockChatBadge).not.toHaveBeenCalled();
  });
});
