"use client";

import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ChatToastNotification } from "@/lib/chat/use-chat-notifications";

type ToastContainerProps = {
  notifications: ChatToastNotification[];
  onDismiss: (id: string) => void;
  onOpenChat: (conversationId: string, id: string) => void;
};

function avatarFallback(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function ChatToastItem(props: {
  notification: ChatToastNotification;
  onDismiss: (id: string) => void;
  onOpenChat: (conversationId: string, id: string) => void;
}) {
  const { notification, onDismiss, onOpenChat } = props;

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);

    return () => globalThis.clearTimeout(timeout);
  }, [notification.id, onDismiss]);

  return (
    <Card className="border-primary/20 bg-card/95 shadow-lg backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={notification.avatarUrl || undefined} alt={notification.title} />
            <AvatarFallback>{avatarFallback(notification.title)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{notification.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.preview}</p>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onOpenChat(notification.conversationId, notification.id)}
              >
                Abrir chat
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ToastContainer({ notifications, onDismiss, onOpenChat }: ToastContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-2">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <ChatToastItem notification={notification} onDismiss={onDismiss} onOpenChat={onOpenChat} />
        </div>
      ))}
    </div>
  );
}
