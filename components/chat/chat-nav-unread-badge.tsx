"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { Badge } from "@/components/ui/badge";
import { getRealtimeDb } from "@/lib/chat/realtime-chat";

type UserConversationMeta = {
  unreadCount?: number;
};

function countUnreadMessagesForUser(
  messagesRecord: Record<string, { senderId?: string; seenBy?: Record<string, unknown>; deleted?: boolean }>,
  userId: string
) {
  return Object.values(messagesRecord).reduce((sum, message) => {
    const isIncoming = Boolean(message.senderId && message.senderId !== userId);
    const seenByCurrentUser = Boolean(message.seenBy && message.seenBy[userId]);
    const isDeleted = Boolean(message.deleted);

    return isIncoming && !seenByCurrentUser && !isDeleted ? sum + 1 : sum;
  }, 0);
}

export function ChatNavUnreadBadge({ userId, isActive = false }: { userId: string; isActive?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribeUserConversations = () => {};
    let messageUnsubscribers: Array<() => void> = [];

    (async () => {
      if (!userId) {
        if (active) setUnreadCount(0);
        return;
      }

      const rtdb = await getRealtimeDb();
      const userConversationsRef = ref(rtdb, `userConversations/${userId}`);

      unsubscribeUserConversations = onValue(userConversationsRef, (snap) => {
        if (!active) return;

        for (const off of messageUnsubscribers) {
          off();
        }
        messageUnsubscribers = [];

        if (!snap.exists()) {
          setUnreadCount(0);
          return;
        }

        const data = snap.val() as Record<string, UserConversationMeta>;
        const conversationIds = Object.keys(data);
        if (conversationIds.length === 0) {
          setUnreadCount(0);
          return;
        }

        const unreadByConversation: Record<string, number> = {};
        const recomputeTotal = () => {
          if (!active) return;
          const total = Object.values(unreadByConversation).reduce((sum, value) => sum + value, 0);
          setUnreadCount(total);
        };

        for (const conversationId of conversationIds) {
          unreadByConversation[conversationId] = 0;
          const conversationMessagesRef = ref(rtdb, `messages/${conversationId}`);

          const offMessages = onValue(
            conversationMessagesRef,
            (messagesSnap) => {
              if (!active) return;

              if (!messagesSnap.exists()) {
                unreadByConversation[conversationId] = 0;
                recomputeTotal();
                return;
              }

              const messagesRecord = messagesSnap.val() as Record<
                string,
                { senderId?: string; seenBy?: Record<string, unknown>; deleted?: boolean }
              >;
              unreadByConversation[conversationId] = countUnreadMessagesForUser(messagesRecord, userId);
              recomputeTotal();
            },
            () => {
              unreadByConversation[conversationId] = 0;
              recomputeTotal();
            }
          );

          messageUnsubscribers.push(offMessages);
        }

        recomputeTotal();
      });
    })();

    return () => {
      active = false;
      unsubscribeUserConversations();
      for (const off of messageUnsubscribers) {
        off();
      }
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
