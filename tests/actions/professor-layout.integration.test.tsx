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
  NotificationsInbox: () => <div data-testid="notifications-inbox" />,
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
    Users: Icon,
    UserCheck: Icon,
    Briefcase: Icon,
    FileText: Icon,
    LogOut: Icon,
    Menu: Icon,
    MessageSquare: Icon,
    User: Icon,
  };
});

import { ProfessorLayout } from "../../components/layout/professor-layout";

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

  mockUsePathname.mockReturnValue("/professor/chat");
  mockGetAuthRuntime.mockResolvedValue({ app: "auth" });
  mockGetDbRuntime.mockResolvedValue({ app: "db" });
  mockDoc.mockReturnValue({ path: "users/profA" });
  mockGetDoc.mockResolvedValue(
    makeUserSnap({
      role: "professor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Professor A",
      email: "prof@school.pt",
      photoURL: "",
    })
  );

  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
    void cb({ uid: "profA", displayName: "Professor A", email: "prof@school.pt" });
    return vi.fn();
  });
});

describe("ProfessorLayout integration", () => {
  it("ativa notificações apenas na página principal /professor", async () => {
    mockUsePathname.mockReturnValue("/professor");

    await act(async () => {
      TestRenderer.create(
        <ProfessorLayout>
          <div>Conteudo</div>
        </ProfessorLayout>
      );
    });

    await flush();

    expect(mockUseChatNotifications).toHaveBeenCalled();
    const lastCallIndex = mockUseChatNotifications.mock.calls.length - 1;
    const props = mockUseChatNotifications.mock.calls[lastCallIndex]?.[0] as {
      enabled: boolean;
      isChatOpen: boolean;
      userId: string;
    };

    expect(props.userId).toBe("profA");
    expect(props.enabled).toBe(true);
    expect(props.isChatOpen).toBe(false);
  });

  it("desativa notificações na rota /professor/chat", async () => {
    mockUsePathname.mockReturnValue("/professor/chat");

    await act(async () => {
      TestRenderer.create(
        <ProfessorLayout>
          <div>Conteudo</div>
        </ProfessorLayout>
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

  it("monta ChatNavUnreadBadge no item Chat em desktop e mobile com rota ativa", async () => {
    await act(async () => {
      TestRenderer.create(
        <ProfessorLayout>
          <div>Conteudo</div>
        </ProfessorLayout>
      );
    });

    await flush();

    // Desktop + mobile both include the Chat nav item.
    expect(mockChatBadge).toHaveBeenCalledTimes(2);

    const calls = mockChatBadge.mock.calls.map((args) => args[0] as { userId: string; isActive?: boolean });
    for (const props of calls) {
      expect(props.userId).toBe("profA");
      expect(props.isActive).toBe(true);
    }
  });

  it("passa isActive=false ao badge fora da rota de chat", async () => {
    mockUsePathname.mockReturnValue("/professor");

    await act(async () => {
      TestRenderer.create(
        <ProfessorLayout>
          <div>Conteudo</div>
        </ProfessorLayout>
      );
    });

    await flush();

    expect(mockChatBadge).toHaveBeenCalledTimes(2);
    const calls = mockChatBadge.mock.calls.map((args) => args[0] as { isActive?: boolean });
    for (const props of calls) {
      expect(props.isActive).toBe(false);
    }
  });

  it("não monta badge quando utilizador não é professor ativo", async () => {
    mockGetDoc.mockResolvedValue(
      makeUserSnap({
        role: "aluno",
        estado: "ativo",
      })
    );

    await act(async () => {
      TestRenderer.create(
        <ProfessorLayout>
          <div>Conteudo</div>
        </ProfessorLayout>
      );
    });

    await flush();

    expect(mockRouterReplace).toHaveBeenCalledWith("/account-status");
    expect(mockChatBadge).not.toHaveBeenCalled();
  });
});
