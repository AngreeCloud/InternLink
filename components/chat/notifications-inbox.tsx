"use client";

import { useEffect, useMemo, useState, type UIEventHandler } from "react";
import { Inbox, CheckCheck, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatToastNotification } from "@/lib/chat/use-chat-notifications";

export type InboxNotification = ChatToastNotification & {
  kind?: "chat" | "system";
  href?: string;
  actionLabel?: string;
  read?: boolean;
  estagioId?: string;
};

type NotificationsInboxProps = {
  notifications: InboxNotification[];
  onOpenChat: (conversationId: string, id: string) => void;
  onOpenNotification?: (notification: InboxNotification) => void;
  onMarkRead?: (notification: InboxNotification) => void;
  onRemove?: (notification: InboxNotification) => void;
  onMarkAllRead?: () => void;
  onClearAll?: () => void;
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

export function NotificationsInbox({
  notifications,
  onOpenChat,
  onOpenNotification,
  onMarkRead,
  onRemove,
  onMarkAllRead,
  onClearAll,
}: NotificationsInboxProps) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);

  const orderedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.lastMessageAt - a.lastMessageAt),
    [notifications]
  );

  const unreadCount = useMemo(
    () =>
      orderedNotifications.filter((item) => {
        if (item.read === true) return false;
        if (item.read === false) return true;
        return !readIds.has(item.id);
      }).length,
    [orderedNotifications, readIds]
  );

  const visibleNotifications = useMemo(
    () => orderedNotifications.slice(0, visibleCount),
    [orderedNotifications, visibleCount]
  );

  useEffect(() => {
    if (!open) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of orderedNotifications) {
        if (n.read !== true && n.read !== false) next.add(n.id);
      }
      return next;
    });
  }, [open, orderedNotifications]);

  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
  }, [orderedNotifications.length]);

  const count = orderedNotifications.length;
  const hasActions = onMarkAllRead || onClearAll;

  const handleListScroll: UIEventHandler<HTMLDivElement> = (event) => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining > 120) return;
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, count));
  };

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

      {open ? (
        <Card className="absolute right-0 top-10 z-50 w-[22rem] shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Caixa de notificações</CardTitle>
              {hasActions && (
                <div className="flex items-center gap-1">
                  {onMarkAllRead && unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => { onMarkAllRead(); setReadIds(new Set(orderedNotifications.map(n => n.id))); }}
                      title="Marcar todas como lidas"
                    >
                      <CheckCheck className="mr-1 h-3 w-3" />
                      Tudo lido
                    </Button>
                  )}
                  {onClearAll && count > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm("Limpar todas as notificações?")) onClearAll(); }}
                      title="Limpar caixa de entrada"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Limpar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto" onScroll={handleListScroll}>
              <div className="space-y-2 p-3">
                {count === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Sem notificações.</p>
                ) : (
                  visibleNotifications.map((notification) => {
                    const isSystem = notification.kind === "system" || Boolean(notification.href);
                    const actionLabel = isSystem
                      ? notification.actionLabel || "Abrir"
                      : "Abrir chat";
                    const read = readIds.has(notification.id);
                    return (
                    <div
                      key={notification.id}
                      data-testid="notification-item"
                      data-read={read ? "true" : "false"}
                      className={[
                        "group relative rounded-md border p-2 transition-colors",
                        read
                          ? "border-border bg-muted/20"
                          : "border-border bg-card shadow-sm",
                      ].join(" ")}
                      onMouseEnter={() => setHoveredId(notification.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Unread dot */}
                      {!read && (
                        <span className="absolute left-1.5 top-3 h-2 w-2 rounded-full bg-primary" />
                      )}

                      <div className="flex items-start gap-2 pl-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={notification.avatarUrl || undefined} alt={notification.title} />
                          <AvatarFallback>{avatarFallback(notification.title)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={[
                              "truncate text-xs font-semibold",
                              read ? "text-muted-foreground" : "text-foreground",
                            ].join(" ")}>{notification.title}</p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatTime(notification.lastMessageAt)}
                            </span>
                          </div>
                          <p className={[
                            "mt-0.5 line-clamp-2 text-xs",
                            read ? "text-muted-foreground/70" : "text-muted-foreground",
                          ].join(" ")}>{notification.preview}</p>

                          {/* Action buttons row */}
                          <div className="mt-2 flex items-center justify-end gap-1">
                            {/* Hover actions */}
                            {hoveredId === notification.id && (
                              <>
                                {onMarkRead && !read && isSystem && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReadIds(prev => new Set(prev).add(notification.id));
                                      onMarkRead(notification);
                                    }}
                                    title="Marcar como lida"
                                  >
                                    <CheckCheck className="h-3 w-3" />
                                  </Button>
                                )}
                                {onRemove && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemove(notification);
                                    }}
                                    title="Remover"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                if (isSystem) {
                                  if (onOpenNotification) {
                                    onOpenNotification(notification);
                                  } else if (notification.href) {
                                    window.location.assign(notification.href);
                                  }
                                } else {
                                  onOpenChat(notification.conversationId, notification.id);
                                }
                                setOpen(false);
                              }}
                            >
                              {actionLabel}
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
