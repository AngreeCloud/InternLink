"use client";

import { useEffect, useMemo, useState, type UIEventHandler } from "react";
import { Inbox } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToastNotification } from "@/lib/chat/use-chat-notifications";

type NotificationsInboxProps = {
  notifications: ChatToastNotification[];
  onOpenChat: (conversationId: string, id: string) => void;
};

const INITIAL_RENDER_COUNT = 25;
const LOAD_MORE_STEP = 20;

function avatarFallback(title: string): string {
  return (
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsInbox({ notifications, onOpenChat }: NotificationsInboxProps) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);

  const orderedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.lastMessageAt - a.lastMessageAt),
    [notifications]
  );

  const unreadCount = useMemo(
    () => orderedNotifications.filter((item) => !readIds.has(item.id)).length,
    [orderedNotifications, readIds]
  );

  const visibleNotifications = useMemo(
    () => orderedNotifications.slice(0, visibleCount),
    [orderedNotifications, visibleCount]
  );

  useEffect(() => {
    if (!open) return;
    if (orderedNotifications.length === 0) return;

    setReadIds((prev) => {
      const next = new Set(prev);
      for (const notification of orderedNotifications) {
        next.add(notification.id);
      }
      return next;
    });
  }, [open, orderedNotifications]);

  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
  }, [orderedNotifications.length]);

  const count = orderedNotifications.length;

  const handleListScroll: UIEventHandler<HTMLDivElement> = (event) => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining > 120) return;

    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, orderedNotifications.length));
  };

  const bubbleLabel = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount === 1) return "1 nova mensagem";
    return `${unreadCount} novas mensagens`;
  }, [unreadCount]);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Caixa de notificações"
        onClick={() => setOpen((prev) => !prev)}
        className="relative h-8 w-8"
      >
        <Inbox className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {unreadCount > 0 && !open ? (
        <div className="pointer-events-none absolute right-0 top-10 z-40">
          <div className="relative rounded-md border border-border bg-card px-2 py-1 text-[11px] text-card-foreground shadow-md">
            {bubbleLabel}
            <div className="absolute -top-1 right-3 h-2 w-2 rotate-45 border-l border-t border-border bg-card" />
          </div>
        </div>
      ) : null}

      {open ? (
        <Card className="absolute right-0 top-10 z-50 w-[22rem] shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Caixa de notificações</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto" onScroll={handleListScroll}>
              <div className="space-y-2 p-3">
                {count === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem notificações.</p>
                ) : (
                  visibleNotifications.map((notification) => {
                    const read = readIds.has(notification.id);
                    return (
                    <div
                      key={notification.id}
                      data-testid="notification-item"
                      data-read={read ? "true" : "false"}
                      className={[
                        "rounded-md border border-border p-2 transition-colors",
                        read ? "bg-muted/35 opacity-75" : "bg-card",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={notification.avatarUrl || undefined} alt={notification.title} />
                          <AvatarFallback>{avatarFallback(notification.title)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold">{notification.title}</p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatTime(notification.lastMessageAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.preview}</p>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                onOpenChat(notification.conversationId, notification.id);
                                setOpen(false);
                              }}
                            >
                              Abrir chat
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
