import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ alt }: { alt?: string }) => <img alt={alt || ""} />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="btn" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Inbox: () => <svg />,
}));

import { NotificationsInbox } from "../../components/chat/notifications-inbox";

describe("NotificationsInbox", () => {
  it("marks notifications as read when opening inbox", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationsInbox
          notifications={[
            {
              id: "n1",
              conversationId: "conv1",
              title: "Maria",
              avatarUrl: "",
              preview: "Olá",
              lastMessageAt: 1710000000000,
            },
          ]}
          onOpenChat={vi.fn()}
        />
      );
    });

    const buttons = renderer!.root.findAllByProps({ "data-testid": "btn" });
    expect(buttons.length).toBeGreaterThan(0);

    await act(async () => {
      (buttons[0].props as { onClick: () => void }).onClick();
    });

    const rows = renderer!.root.findAllByProps({ "data-testid": "notification-item" });
    expect(rows.length).toBe(1);
    expect((rows[0].props as { "data-read": string })["data-read"]).toBe("true");
  });

  it("opens chat with selected conversation", async () => {
    const onOpenChat = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationsInbox
          notifications={[
            {
              id: "n2",
              conversationId: "conv2",
              title: "Grupo A",
              avatarUrl: "",
              preview: "Nova mensagem",
              lastMessageAt: 1710000001000,
            },
          ]}
          onOpenChat={onOpenChat}
        />
      );
    });

    const buttons = renderer!.root.findAllByProps({ "data-testid": "btn" });

    await act(async () => {
      (buttons[0].props as { onClick: () => void }).onClick();
    });

    const panelButtons = renderer!.root.findAllByProps({ "data-testid": "btn" });
    await act(async () => {
      (panelButtons[panelButtons.length - 1].props as { onClick: () => void }).onClick();
    });

    expect(onOpenChat).toHaveBeenCalledWith("conv2", "n2");
  });
});
