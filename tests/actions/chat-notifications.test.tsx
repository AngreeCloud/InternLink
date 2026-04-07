import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ alt }: { alt?: string }) => <img alt={alt || ""} />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="mock-button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { buildNotificationPreview, shouldNotifyConversation } from "../../lib/chat/use-chat-notifications";
import { ToastContainer } from "../../components/chat/toast-container";

describe("chat notification helpers", () => {
  it("builds attachment preview", () => {
    expect(buildNotificationPreview("[Anexo]", false)).toBe("📎 Anexo enviado");
    expect(buildNotificationPreview(null, true)).toBe("📎 Anexo enviado");
  });

  it("builds text preview", () => {
    expect(buildNotificationPreview("  Olá  ", false)).toBe("Olá");
  });

  it("detects unread incoming message only", () => {
    expect(
      shouldNotifyConversation({ lastMessageAt: 200, lastSeenAt: 100 }, "user-b", "user-a")
    ).toBe(true);

    expect(
      shouldNotifyConversation({ lastMessageAt: 100, lastSeenAt: 100 }, "user-b", "user-a")
    ).toBe(false);

    expect(
      shouldNotifyConversation({ lastMessageAt: 200, lastSeenAt: 100 }, "user-a", "user-a")
    ).toBe(false);
  });
});

describe("ToastContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto dismisses after 5 seconds", async () => {
    const onDismiss = vi.fn();
    const onOpenChat = vi.fn();

    await act(async () => {
      TestRenderer.create(
        <ToastContainer
          notifications={[
            {
              id: "toast-1",
              conversationId: "conv-1",
              title: "Joao",
              avatarUrl: "",
              preview: "Mensagem",
              lastMessageAt: 100,
            },
          ]}
          onDismiss={onDismiss}
          onOpenChat={onOpenChat}
        />
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDismiss).toHaveBeenCalledWith("toast-1");
  });

  it("opens chat when clicking action", async () => {
    const onDismiss = vi.fn();
    const onOpenChat = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <ToastContainer
          notifications={[
            {
              id: "toast-2",
              conversationId: "conv-2",
              title: "Grupo A",
              avatarUrl: "",
              preview: "Nova mensagem",
              lastMessageAt: 200,
            },
          ]}
          onDismiss={onDismiss}
          onOpenChat={onOpenChat}
        />
      );
    });

    const openButton = renderer!.root.findAllByProps({ "data-testid": "mock-button" })[0];

    await act(async () => {
      (openButton.props as { onClick: () => void }).onClick();
    });

    expect(onOpenChat).toHaveBeenCalledWith("conv-2", "toast-2");
  });
});
