import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockOnValue = vi.fn();
const mockRef = vi.fn();
const mockGetRealtimeDb = vi.fn();

vi.mock("firebase/database", () => ({
  onValue: (...args: unknown[]) => mockOnValue(...args),
  ref: (...args: unknown[]) => mockRef(...args),
}));

vi.mock("@/lib/chat/realtime-chat", () => ({
  getRealtimeDb: (...args: unknown[]) => mockGetRealtimeDb(...args),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

import { ChatNavUnreadBadge, getTotalUnreadCount } from "../../components/chat/chat-nav-unread-badge";

type MockSnapshot = {
  exists: () => boolean;
  val: () => Record<string, { unreadCount?: number }>;
};

let onValueCallback: ((snap: MockSnapshot) => void) | undefined;
let onErrorCallback: (() => void) | undefined;
let unsubscribeMock: ReturnType<typeof vi.fn>;

function makeSnapshot(data: Record<string, { unreadCount?: number }> | null): MockSnapshot {
  return {
    exists: () => Boolean(data),
    val: () => data || {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  unsubscribeMock = vi.fn();
  onValueCallback = undefined;
  onErrorCallback = undefined;

  mockGetRealtimeDb.mockResolvedValue({ app: "rtdb" });
  mockRef.mockImplementation((_db: unknown, path: string) => ({ path }));

  mockOnValue.mockImplementation(
    (_ref: unknown, onNext: (snap: MockSnapshot) => void, onError: () => void) => {
      onValueCallback = onNext;
      onErrorCallback = onError;
      return unsubscribeMock;
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTotalUnreadCount", () => {
  it("soma apenas valores unread positivos", () => {
    expect(
      getTotalUnreadCount({
        a: { unreadCount: 2 },
        b: { unreadCount: 0 },
        c: { unreadCount: -3 },
        d: {},
      })
    ).toBe(2);
  });
});

describe("ChatNavUnreadBadge", () => {
  it("mostra o notificador quando existe unreadCount > 0", async () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<ChatNavUnreadBadge userId="profA" />);
      await Promise.resolve();
    });

    await act(async () => {
      onValueCallback?.(makeSnapshot({ convDirect: { unreadCount: 1 } }));
    });

    const badges = renderer!.root.findAllByProps({ "data-testid": "badge" });
    expect(badges.length).toBe(1);
    expect(String(badges[0].children[0])).toBe("1");
  });

  it("oculta o notificador quando não há mensagens por ler", async () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<ChatNavUnreadBadge userId="profA" />);
      await Promise.resolve();
    });

    await act(async () => {
      onValueCallback?.(makeSnapshot({ convDirect: { unreadCount: 0 } }));
    });

    const badges = renderer!.root.findAllByProps({ "data-testid": "badge" });
    expect(badges.length).toBe(0);
  });

  it("mostra 9+ quando total de unread é >= 10", async () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<ChatNavUnreadBadge userId="profA" />);
      await Promise.resolve();
    });

    await act(async () => {
      onValueCallback?.(makeSnapshot({ conv1: { unreadCount: 4 }, conv2: { unreadCount: 6 } }));
    });

    const badges = renderer!.root.findAllByProps({ "data-testid": "badge" });
    expect(badges.length).toBe(1);
    expect(String(badges[0].children[0])).toBe("9+");
  });

  it("aplica estilo de aba ativa quando isActive=true", async () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<ChatNavUnreadBadge userId="profA" isActive />);
      await Promise.resolve();
    });

    await act(async () => {
      onValueCallback?.(makeSnapshot({ convDirect: { unreadCount: 1 } }));
    });

    const badge = renderer!.root.findByProps({ "data-testid": "badge" });
    expect(String(badge.props.className)).toContain("bg-red-600");
  });

  it("faz unsubscribe no unmount", async () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<ChatNavUnreadBadge userId="profA" />);
      await Promise.resolve();
    });

    await act(async () => {
      renderer!.unmount();
    });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it("reseta para zero quando há erro de leitura", async () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<ChatNavUnreadBadge userId="profA" />);
      await Promise.resolve();
    });

    await act(async () => {
      onValueCallback?.(makeSnapshot({ convDirect: { unreadCount: 3 } }));
    });

    let badges = renderer!.root.findAllByProps({ "data-testid": "badge" });
    expect(badges.length).toBe(1);
    expect(String(badges[0].children[0])).toBe("3");

    await act(async () => {
      onErrorCallback?.();
    });

    badges = renderer!.root.findAllByProps({ "data-testid": "badge" });
    expect(badges.length).toBe(0);
  });
});
