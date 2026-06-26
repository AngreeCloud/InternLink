"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EstagioNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: unknown;
  createdAtMs: number;
  estagioId: string;
  requestId?: string;
  requestType?: string;
  targetDate?: string;
  docId?: string;
};

const POLL_INTERVAL_MS = 30_000;

export function useEstagioNotifications(params: {
  userId: string;
  enabled: boolean;
  limitCount?: number;
}) {
  const { userId, enabled, limitCount = 100 } = params;
  const [notifications, setNotifications] = useState<EstagioNotification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) {
          // 401/403 are normal during logout transitions — don't log as errors
          if (res.status !== 401 && res.status !== 403) {
            console.error("[v0] estagio notifications fetch", res.status);
          }
          return;
        }
        const json = (await res.json()) as {
          ok: boolean;
          notifications: EstagioNotification[];
        };
        if (!json.ok || cancelled) return;
        let list = json.notifications;
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        if (list.length > limitCount) list.length = limitCount;
        setNotifications(list);
      } catch (err) {
        console.error("[v0] estagio notifications fetch error", err);
      }
    }

    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, limitCount, userId]);

  const markAsRead = useCallback(async (estagioId: string, notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estagioId, notificationId }),
      });
    } catch (err) {
      console.error("[v0] mark notification read error", err);
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.readAt == null).length,
    [notifications]
  );

  return { notifications, unreadCount, markAsRead };
}
