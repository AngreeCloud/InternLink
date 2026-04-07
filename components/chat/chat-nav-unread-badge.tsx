"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { Badge } from "@/components/ui/badge";
import { getRealtimeDb } from "@/lib/chat/realtime-chat";

type UserConversationMeta = {
  unreadCount?: number;
};

export function getTotalUnreadCount(data: Record<string, UserConversationMeta>): number {
  return Object.values(data).reduce((sum, meta) => {
    const unread = typeof meta?.unreadCount === "number" ? meta.unreadCount : 0;
    return sum + (unread > 0 ? unread : 0);
  }, 0);
}

export function ChatNavUnreadBadge({ userId, isActive = false }: { userId: string; isActive?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribeUserConversations = () => {};

    (async () => {
      if (!userId) {
        if (active) setUnreadCount(0);
        return;
      }

      const rtdb = await getRealtimeDb();
      const userConversationsRef = ref(rtdb, `userConversations/${userId}`);

      unsubscribeUserConversations = onValue(
        userConversationsRef,
        (snap) => {
          if (!active) return;

          if (!snap.exists()) {
            setUnreadCount(0);
            return;
          }

          const data = snap.val() as Record<string, UserConversationMeta>;
          const total = getTotalUnreadCount(data);

          setUnreadCount(total);
        },
        () => {
          if (!active) return;
          setUnreadCount(0);
        }
      );
    })();

    return () => {
      active = false;
      unsubscribeUserConversations();
    };
  }, [userId]);

  if (unreadCount <= 0) {
    return null;
  }

  const label = unreadCount >= 10 ? "9+" : String(unreadCount);

  return (
    <Badge
      className={[
        "ml-2 h-5 min-w-5 justify-center rounded-full border px-1 text-[10px] leading-none",
        isActive
          ? "border-red-400 bg-red-600 text-white shadow-[0_0_0_1px_rgba(239,68,68,0.35)]"
          : "border-red-500/40 bg-red-500/15 text-red-500",
      ].join(" ")}
    >
      {label}
    </Badge>
  );
}
