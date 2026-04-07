"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref, get } from "firebase/database";
import { getChatProfilesByIds, getRealtimeDb } from "@/lib/chat/realtime-chat";

type UserConversationMeta = {
  lastMessageText?: string | null;
  lastMessageAt?: number;
  lastSeenAt?: number;
};

type ConversationRecord = {
  type?: "direct" | "group";
  participants?: Record<string, true>;
  lastMessage?: {
    text?: string | null;
    senderId?: string;
    createdAt?: number;
    hasAttachments?: boolean;
  };
};

export type ChatToastNotification = {
  id: string;
  conversationId: string;
  title: string;
  avatarUrl: string;
  preview: string;
  lastMessageAt: number;
};

type ProfileLite = {
  name: string;
  photoURL: string;
};

const SESSION_FLAG_PREFIX = "chatNotificationsShown";
const MAX_NOTIFICATION_HISTORY = 300;

export function buildNotificationPreview(text: string | null | undefined, hasAttachments: boolean): string {
  const normalized = typeof text === "string" ? text.trim() : "";
  if (normalized === "[Anexo]" || (hasAttachments && !normalized)) {
    return "📎 Anexo enviado";
  }

  if (!normalized) {
    return hasAttachments ? "📎 Anexo enviado" : "Nova mensagem";
  }

  return normalized;
}

export function shouldNotifyConversation(meta: UserConversationMeta, senderId: string, currentUserId: string): boolean {
  const lastMessageAt = Number(meta.lastMessageAt || 0);
  const lastSeenAt = Number(meta.lastSeenAt || 0);

  if (!lastMessageAt) return false;
  if (senderId === currentUserId) return false;

  return lastMessageAt > lastSeenAt;
}

function getSessionFlagKey(userId: string): string {
  return `${SESSION_FLAG_PREFIX}:${userId}`;
}

export function useChatNotifications(params: {
  userId: string;
  enabled: boolean;
  isChatOpen: boolean;
  onOpenConversation: (conversationId: string) => void;
}) {
  const { userId, enabled, isChatOpen, onOpenConversation } = params;
  const [notifications, setNotifications] = useState<ChatToastNotification[]>([]);

  const shownConversationIdsRef = useRef(new Set<string>());
  const profileCacheRef = useRef(new Map<string, ProfileLite>());
  const processingRef = useRef(false);
  const queuedRecordsRef = useRef<Record<string, UserConversationMeta> | null | undefined>(undefined);
  const disposedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUserIdRef = useRef("");

  const handleOpenConversation = useCallback(
    (conversationId: string, _id: string) => {
      onOpenConversation(conversationId);
    },
    [onOpenConversation]
  );

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;

    if (!userId && previousUserId) {
      shownConversationIdsRef.current.clear();
      profileCacheRef.current.clear();
      setNotifications([]);

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(getSessionFlagKey(previousUserId));
      }
    }

    previousUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;

    disposedRef.current = false;
    shownConversationIdsRef.current.clear();
    profileCacheRef.current.clear();
    queuedRecordsRef.current = undefined;
    processingRef.current = false;

    let detachListener = () => {};

    const loadProfiles = async (ids: string[]): Promise<Record<string, ProfileLite>> => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) return {};

      const missing = uniqueIds.filter((id) => !profileCacheRef.current.has(id));
      if (missing.length > 0) {
        const profiles = await getChatProfilesByIds(missing);
        for (const profile of profiles) {
          profileCacheRef.current.set(profile.uid, {
            name: profile.name,
            photoURL: profile.photoURL,
          });
        }
      }

      return uniqueIds.reduce<Record<string, ProfileLite>>((acc, id) => {
        const cached = profileCacheRef.current.get(id);
        if (cached) acc[id] = cached;
        return acc;
      }, {});
    };

    const attachListener = async (retryAttempt: number) => {
      try {
        const rtdb = await getRealtimeDb();
        if (disposedRef.current) return;

        const sessionKey = getSessionFlagKey(userId);
        const alreadyShownThisSession =
          typeof window !== "undefined" && window.sessionStorage.getItem(sessionKey) === "true";

        if (alreadyShownThisSession) {
          return;
        }

        const userConversationsRef = ref(rtdb, `userConversations/${userId}`);

        const processRecords = async (records: Record<string, UserConversationMeta> | null) => {
          const markShown = () => {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(sessionKey, "true");
            }
          };

          if (isChatOpen) {
            markShown();
            return;
          }

          if (!records || Object.keys(records).length === 0) {
            markShown();
            return;
          }

          const candidateIds = Object.keys(records).filter((conversationId) => {
            if (shownConversationIdsRef.current.has(conversationId)) return false;
            const meta = records[conversationId] || {};
            const lastMessageAt = Number(meta.lastMessageAt || 0);
            const lastSeenAt = Number(meta.lastSeenAt || 0);
            return lastMessageAt > lastSeenAt;
          });

          if (candidateIds.length === 0) {
            markShown();
            return;
          }

          const conversationSnaps = await Promise.all(
            candidateIds.map(async (conversationId) => {
              const snap = await get(ref(rtdb, `conversations/${conversationId}`));
              return { conversationId, snap };
            })
          );

          const nextNotifications: ChatToastNotification[] = [];

          for (const { conversationId, snap } of conversationSnaps) {
            if (!snap.exists()) continue;

            const meta = records[conversationId] || {};
            const conversation = snap.val() as ConversationRecord;
            const senderId = conversation.lastMessage?.senderId || "";

            if (!shouldNotifyConversation(meta, senderId, userId)) {
              continue;
            }

            const participantIds = Object.keys(conversation.participants || {});
            const peerIds = participantIds.filter((uid) => uid !== userId);
            const directPeerId = conversation.type === "direct" ? senderId || peerIds[0] || "" : "";
            const groupAvatarId = conversation.type === "group" ? peerIds[0] || "" : "";
            const profileById = await loadProfiles(
              [senderId, directPeerId, groupAvatarId].filter(Boolean)
            );

            const senderProfile = senderId ? profileById[senderId] : undefined;
            const title =
              conversation.type === "group"
                ? "Grupo"
                : senderProfile?.name || profileById[directPeerId]?.name || "Mensagem direta";

            const avatarUrl =
              conversation.type === "group"
                ? profileById[groupAvatarId]?.photoURL || ""
                : senderProfile?.photoURL || profileById[directPeerId]?.photoURL || "";

            const preview = buildNotificationPreview(
              typeof meta.lastMessageText === "string"
                ? meta.lastMessageText
                : conversation.lastMessage?.text,
              Boolean(conversation.lastMessage?.hasAttachments)
            );

            const lastMessageAt = Number(meta.lastMessageAt || conversation.lastMessage?.createdAt || Date.now());

            shownConversationIdsRef.current.add(conversationId);
            nextNotifications.push({
              id: `${conversationId}-${lastMessageAt}`,
              conversationId,
              title,
              avatarUrl,
              preview,
              lastMessageAt,
            });
          }

          if (nextNotifications.length > 0) {
            nextNotifications.sort((a, b) => a.lastMessageAt - b.lastMessageAt);
            setNotifications((prev) => {
              const existingIds = new Set(prev.map((item) => item.id));
              const unique = nextNotifications.filter((item) => !existingIds.has(item.id));
              const merged = [...prev, ...unique];
              if (merged.length <= MAX_NOTIFICATION_HISTORY) return merged;

              return merged.slice(merged.length - MAX_NOTIFICATION_HISTORY);
            });
          }

          markShown();
        };

        const flushQueue = async () => {
          if (processingRef.current) return;

          processingRef.current = true;
          try {
            while (queuedRecordsRef.current !== undefined && !disposedRef.current) {
              const records = queuedRecordsRef.current;
              queuedRecordsRef.current = undefined;
              await processRecords(records || null);
            }
          } finally {
            processingRef.current = false;
          }
        };

        detachListener = onValue(
          userConversationsRef,
          (snap) => {
            if (disposedRef.current) return;
            queuedRecordsRef.current = snap.exists()
              ? ((snap.val() || {}) as Record<string, UserConversationMeta>)
              : null;

            void flushQueue();
          },
          () => {
            if (disposedRef.current) return;
            detachListener();

            const delay = Math.min(1000 * 2 ** retryAttempt, 30000);
            reconnectTimerRef.current = globalThis.setTimeout(() => {
              void attachListener(retryAttempt + 1);
            }, delay);
          }
        );
      } catch {
        if (disposedRef.current) return;
        const delay = Math.min(1000 * 2 ** retryAttempt, 30000);
        reconnectTimerRef.current = globalThis.setTimeout(() => {
          void attachListener(retryAttempt + 1);
        }, delay);
      }
    };

    void attachListener(0);

    return () => {
      disposedRef.current = true;
      detachListener();
      if (reconnectTimerRef.current) {
        globalThis.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [enabled, isChatOpen, userId]);

  return {
    notifications,
    handleOpenConversation,
  };
}
