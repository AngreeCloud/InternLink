"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, set } from "firebase/database";
import {
  CHAT_ATTACHMENTS_MAX_FILES,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_MESSAGE_MAX_CHARS,
  blockExternalUser,
  createConversationFromUsers,
  deleteMessage,
  editMessage,
  ensureOrgMemberIndex,
  formatChatRelativeTime,
  getChatProfilesByIds,
  getCurrentChatProfile,
  getRealtimeDb,
  isSameDay,
  isValidEmail,
  loadOlderMessages,
  markConversationSeen,
  reportUserBySpam,
  removeUserConversation,
  restoreDeletedMessage,
  searchInternalMembers,
  sendMessage,
  subscribeConversationMessages,
  subscribeUserConversations,
  unblockUser,
} from "@/lib/chat/realtime-chat";
import { resolveConversationPreview } from "@/lib/chat/chat-preview";
import type {
  ChatConversation,
  ChatMessage,
  ChatMessageView,
  ChatRole,
  ChatUserProfile,
  UserConversationMeta,
} from "@/lib/types/chat";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  Eye,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserMinus,
} from "lucide-react";

type ConversationItem = {
  conversation: ChatConversation;
  meta: UserConversationMeta;
};

type PendingMessage = {
  tempId: string;
  text: string;
  files: File[];
  createdAt: number;
  deliveryState: "sending" | "failed";
};

const PAGE_SIZE = 30;
const MESSAGE_SEQUENCE_WINDOW_MS = 60 * 60 * 1000;

function initials(name: string): string {
  const chunks = name.trim().split(/\s+/).slice(0, 2);
  return chunks.map((item) => item[0]?.toUpperCase() || "").join("") || "?";
}

function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEditedMeta(editedAt: number | null): string | null {
  if (!editedAt) return null;
  return `editada às ${formatMessageTime(editedAt)}`;
}

function formatMessageDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayDivider(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pt-PT");
}

function getRoleLabel(role: ChatRole): string {
  switch (role) {
    case "student":
      return "Aluno";
    case "teacher":
      return "Professor";
    case "tutor":
      return "Tutor";
    case "admin":
      return "";
    case "encarregado":
      return "Enc. Educação";
    default:
      return "Utilizador";
  }
}

function shouldShowRole(role: ChatRole): boolean {
  return role !== "admin";
}

function getDeliveryMeta(
  message: ChatMessageView,
  seenByOthers: boolean
): { label: string; icon: JSX.Element; className?: string } {
  if (seenByOthers) {
    return {
      label: "Visto",
      icon: <Eye className="h-3.5 w-3.5" />,
    };
  }

  return {
    label: "Recebido",
    icon: <Check className="h-3.5 w-3.5" />,
  };
}

export function InternalChatHub() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ChatUserProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingByUserId, setTypingByUserId] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [isDmDialogOpen, setIsDmDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<ChatUserProfile[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [externalEmail, setExternalEmail] = useState("");
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState("");
  const [spotlightResults, setSpotlightResults] = useState<ChatUserProfile[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(-1);
  const spotlightInputRef = useRef<HTMLInputElement>(null);

  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState("");

  const [participantProfiles, setParticipantProfiles] = useState<Record<string, ChatUserProfile>>({});
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const searchParams = useSearchParams();

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeConversationsRef = useRef<() => void>(() => {});
  const unsubscribeMessagesRef = useRef<() => void>(() => {});
  const unsubscribeTypingRef = useRef<() => void>(() => {});
  const unsubscribeAuthRef = useRef<() => void>(() => {});
  const lastSeenWriteRef = useRef(0);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingFlagRef = useRef(false);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const requestedConversationId = useMemo(
    () => searchParams.get("conversationId")?.trim() || "",
    [searchParams]
  );

  const selectedParticipantIds = useMemo(() => {
    if (!selectedConversation) return [];
    return Object.keys(selectedConversation.conversation.participants);
  }, [selectedConversation]);

  const selectedParticipants = useMemo(
    () => selectedParticipantIds.map((uid) => participantProfiles[uid]).filter(Boolean),
    [selectedParticipantIds, participantProfiles]
  );

  const hasMessageBeenSeenByOthers = useCallback(
    (message: ChatMessageView): boolean => {
      if (!profile || !selectedConversation) return false;

      const participantIds = Object.keys(selectedConversation.conversation.participants || {});
      if (participantIds.length <= 1) return false;

      const readState = selectedConversation.conversation.readState || {};
      const seenViaReadState = participantIds.some((uid) => {
        if (uid === profile.uid) return false;
        const seenAt = readState[uid];
        return typeof seenAt === "number" && seenAt >= message.createdAt;
      });
      if (seenViaReadState) return true;

      // Backward compatibility for messages that still carry seenBy receipts.
      return Object.entries(message.seenBy || {}).some(([uid, seenAt]) => {
        if (uid === profile.uid) return false;
        return typeof seenAt === "number";
      });
    },
    [profile, selectedConversation]
  );

  const otherParticipants = useMemo(() => {
    if (!profile) return [];
    return selectedParticipants.filter((item) => item.uid !== profile.uid);
  }, [profile, selectedParticipants]);

  const suggestedMembersFromConversations = useMemo(() => {
    if (!profile) return [];

    const byId = new Map<string, ChatUserProfile>();
    for (const item of conversations) {
      const ids = Object.keys(item.conversation.participants || {});
      for (const uid of ids) {
        if (uid === profile.uid) continue;
        const candidate = participantProfiles[uid];
        if (!candidate) continue;
        byId.set(uid, candidate);
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  }, [conversations, participantProfiles, profile]);

  const hasMixedRolesInConversation = useMemo(() => {
    const uniqueRoles = new Set(selectedParticipants.map((item) => item.role));
    return uniqueRoles.size > 1;
  }, [selectedParticipants]);

  const isDirect = selectedConversation?.conversation.type === "direct";
  const directPeer = isDirect ? otherParticipants[0] || null : null;
  const directPeerIsExternal = Boolean(profile && directPeer && profile.orgId !== directPeer.orgId);
  const canShowReportSpam = Boolean(directPeer && directPeerIsExternal && directPeer.role !== "tutor");

  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [blockedByPeers, setBlockedByPeers] = useState<Set<string>>(new Set());
  const [deletedAccounts, setDeletedAccounts] = useState<Set<string>>(new Set());

  const mergedMessages = useMemo<ChatMessageView[]>(() => {
    const sent = messages.map((message) => ({ ...message, deliveryState: "sent" as const }));
    const inSent = new Set(sent.map((m) => `${m.senderId}:${m.text}:${m.createdAt}`));
    const pending = pendingMessages
      .filter(
        (p) => !inSent.has(`${profile?.uid || ""}:${p.text}:${p.createdAt}`)
      )
      .map((pendingMessage) => ({
        id: pendingMessage.tempId,
        senderId: profile?.uid || "",
        text: pendingMessage.text,
        attachments: {},
        createdAt: pendingMessage.createdAt,
        editedAt: null,
        deleted: false,
        deletedAt: null,
        seenBy: profile ? { [profile.uid]: pendingMessage.createdAt } : {},
        deliveryState: pendingMessage.deliveryState,
        tempId: pendingMessage.tempId,
      }));

    return [...sent, ...pending].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, pendingMessages, profile]);

  const lastOwnSentMessageId = useMemo(() => {
    if (!profile) return "";

    for (let index = mergedMessages.length - 1; index >= 0; index -= 1) {
      const message = mergedMessages[index];
      if (message.senderId !== profile.uid) continue;
      if (message.deliveryState !== "sent") continue;
      if (message.deleted) continue;
      return message.id;
    }

    return "";
  }, [mergedMessages, profile]);

  const conversationTitle = useMemo(() => {
    if (!selectedConversation) return "Conversa";
    if (selectedConversation.conversation.type === "direct") {
      return directPeer?.name || "Mensagem direta";
    }
    const names = otherParticipants.slice(0, 3).map((item) => item.name);
    return names.length ? names.join(", ") : "Grupo";
  }, [selectedConversation, directPeer, otherParticipants]);

  const activeTypers = useMemo(() => {
    if (!profile) return [];
    return Object.entries(typingByUserId)
      .filter(([uid, value]) => uid !== profile.uid && Boolean(value))
      .map(([uid]) => participantProfiles[uid]?.name || "Alguém");
  }, [typingByUserId, participantProfiles, profile]);

  const loadParticipantProfiles = useCallback(async (items: ConversationItem[]) => {
    const idSet = new Set<string>();
    for (const item of items) {
      Object.keys(item.conversation.participants).forEach((id) => idSet.add(id));
    }

    if (idSet.size === 0) {
      setParticipantProfiles({});
      setDeletedAccounts(new Set());
      return;
    }

    const allIds = Array.from(idSet);
    const loaded = await getChatProfilesByIds(allIds);
    const loadedIds = new Set(loaded.map((p) => p.uid));
    const missingIds = allIds.filter((id) => !loadedIds.has(id));

    setParticipantProfiles(
      loaded.reduce<Record<string, ChatUserProfile>>((acc, item) => {
        acc[item.uid] = item;
        return acc;
      }, {})
    );

    if (missingIds.length > 0) {
      setDeletedAccounts((prev) => {
        const next = new Set(prev);
        missingIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const auth = await getAuthRuntime();

        unsubscribeAuthRef.current = onAuthStateChanged(auth, async (user) => {
          if (!isActive) return;

          try {
            if (!user) {
              setProfile(null);
              setLoading(false);
              return;
            }

            const currentProfile = await getCurrentChatProfile();
            if (!currentProfile) {
              setProfile(null);
              setLoading(false);
              return;
            }

            setProfile(currentProfile);

            // Load blocked users list
            void (async () => {
              try {
                const rtdb = await getRealtimeDb();
                const blocksSnap = await get(ref(rtdb, `userBlocks/${currentProfile.uid}`));
                if (blocksSnap.exists()) {
                  setBlockedUsers(new Set(Object.keys(blocksSnap.val())));
                }
              } catch {
                // Block list loading is auxiliary.
              }
            })();

            // Do not block chat boot if org index update fails.
            void ensureOrgMemberIndex(currentProfile).catch((err) => {
              setError((err as Error).message || "Falha ao sincronizar índice de membros.");
            });

            unsubscribeConversationsRef.current?.();
            unsubscribeConversationsRef.current = await subscribeUserConversations(
              currentProfile.uid,
              async (items) => {
                if (!isActive) return;
                setConversations(items);
                await loadParticipantProfiles(items);
                setSelectedConversationId((prev) => {
                  if (
                    requestedConversationId &&
                    items.some((item) => item.conversation.id === requestedConversationId)
                  ) {
                    return requestedConversationId;
                  }

                  if (prev && items.some((item) => item.conversation.id === prev)) {
                    return prev;
                  }

                  // Keep no active conversation by default. Unread should only clear
                  // when the user explicitly opens the target conversation.
                  return "";
                });
                setLoading(false);
              },
              (err) => {
                setError(err.message || "Falha ao carregar conversas.");
                setLoading(false);
              }
            );
          } catch (err) {
            if (!isActive) return;
            setError((err as Error).message || "Falha ao inicializar chat.");
            setLoading(false);
          }
        });
      } catch (err) {
        if (!isActive) return;
        setError((err as Error).message || "Falha ao inicializar Firebase para chat.");
        setLoading(false);
      }
    })();

    return () => {
      isActive = false;
      unsubscribeAuthRef.current?.();
      unsubscribeConversationsRef.current?.();
      unsubscribeMessagesRef.current?.();
      unsubscribeTypingRef.current?.();
    };
  }, [loadParticipantProfiles, requestedConversationId]);

  // Load blockedByPeers state for the selected DM
  useEffect(() => {
    if (!profile || !directPeer) {
      setBlockedByPeers(new Set());
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const rtdb = await getRealtimeDb();
        const snap = await get(ref(rtdb, `userBlocks/${directPeer.uid}/${profile.uid}`));
        if (!canceled) {
          setBlockedByPeers((prev) => {
            const next = new Set(prev);
            if (snap.exists() && snap.val() === true) {
              next.add(directPeer.uid);
            } else {
              next.delete(directPeer.uid);
            }
            return next;
          });
        }
      } catch {
        // Best-effort.
      }
    })();

    return () => {
      canceled = true;
    };
  }, [profile, directPeer?.uid]);

  useEffect(() => {
    if (!selectedConversation || !profile) {
      setMessages([]);
      return;
    }

    let active = true;

    (async () => {
      unsubscribeMessagesRef.current?.();
      unsubscribeTypingRef.current?.();

      unsubscribeMessagesRef.current = await subscribeConversationMessages(
        selectedConversation.conversation.id,
        PAGE_SIZE,
        async (list) => {
          if (!active) return;
          setMessages(list);
          setHasMore(list.length >= PAGE_SIZE);

          const newest = list[list.length - 1] || null;
          const now = Date.now();
          if (newest && now - lastSeenWriteRef.current > 2500) {
            lastSeenWriteRef.current = now;
            await markConversationSeen(selectedConversation.conversation.id, profile.uid, newest);
          }
        },
        (err) => setError(err.message || "Falha ao carregar mensagens.")
      );

      const rtdb = await getRealtimeDb();
      const typingRef = ref(rtdb, `typing/${selectedConversation.conversation.id}`);
      const offTyping = onValue(typingRef, (snap) => {
        setTypingByUserId((snap.val() || {}) as Record<string, boolean>);
      });

      unsubscribeTypingRef.current = () => offTyping();
    })();

    return () => {
      active = false;
      unsubscribeMessagesRef.current?.();
      unsubscribeTypingRef.current?.();
      setTypingByUserId({});
    };
  }, [selectedConversation, profile]);

  useEffect(() => {
    if (!profile || conversations.length === 0) {
      setUnreadByConversation({});
      return;
    }

    const nextUnreadByConversation: Record<string, number> = {};
    for (const item of conversations) {
      const conversationId = item.conversation.id;
      const unreadCount = typeof item.meta.unreadCount === "number" ? item.meta.unreadCount : 0;
      nextUnreadByConversation[conversationId] = unreadCount > 0 ? unreadCount : 0;
    }

    setUnreadByConversation(nextUnreadByConversation);
  }, [conversations, profile]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mergedMessages.length, selectedConversationId]);

  const suggestedRef = useRef(suggestedMembersFromConversations);
  suggestedRef.current = suggestedMembersFromConversations;

  useEffect(() => {
    if ((!isDmDialogOpen && !isGroupDialogOpen) || !profile) return;

    let canceled = false;
    const delay = memberQuery.trim() ? 180 : 0;

    const timeout = window.setTimeout(async () => {
      const results = await searchInternalMembers(
        profile.orgId ?? null,
        memberQuery,
        profile.uid,
        profile.role
      );

      if (canceled) return;

      const suggested = suggestedRef.current;
      const term = memberQuery.trim().toLowerCase();
      const recentSet = new Set(suggested.map((item) => item.uid));
      const merged = new Map<string, ChatUserProfile>();

      // Only merge recent contacts that match the search term (when query is non-empty)
      const suggestedFiltered = term
        ? suggested.filter(
            (m) =>
              m.name.toLowerCase().includes(term) ||
              m.email.toLowerCase().includes(term)
          )
        : suggested;

      for (const item of suggestedFiltered) merged.set(item.uid, item);
      for (const item of results) merged.set(item.uid, item);
      const all = Array.from(merged.values());

      const recentFirst = [
        ...all.filter((item) => recentSet.has(item.uid)),
        ...all.filter((item) => !recentSet.has(item.uid)),
      ];

      setMemberResults(recentFirst);
    }, delay);

    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [memberQuery, isDmDialogOpen, isGroupDialogOpen, profile]);

  // Spotlight search effect
  useEffect(() => {
    if (!isSpotlightOpen || !profile) return;

    let canceled = false;
    const delay = spotlightQuery.trim() ? 180 : 0;

    const timeout = window.setTimeout(async () => {
      const results = await searchInternalMembers(
        profile.orgId ?? null,
        spotlightQuery,
        profile.uid,
        profile.role
      );
      if (!canceled) {
        setSpotlightResults(results);
        setSpotlightIndex(-1);
      }
    }, delay);

    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [spotlightQuery, isSpotlightOpen, profile]);

  useEffect(() => {
    if (isSpotlightOpen && spotlightInputRef.current) {
      const timer = setTimeout(() => spotlightInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isSpotlightOpen]);

  const handleSpotlightKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSpotlightIndex((prev) =>
          prev < spotlightResults.length - 1 ? prev + 1 : prev
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSpotlightIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (event.key === "Enter" && spotlightIndex >= 0) {
        event.preventDefault();
        const member = spotlightResults[spotlightIndex];
        if (member) handleSpotlightSelect(member);
      }
    },
    [spotlightResults, spotlightIndex]
  );

  const handleSpotlightSelect = useCallback(
    async (member: ChatUserProfile) => {
      if (!profile) return;

      const existing = conversations.find((item) => {
        if (item.conversation.type !== "direct") return false;
        const ids = Object.keys(item.conversation.participants);
        return ids.length === 2 && ids.includes(member.uid) && ids.includes(profile.uid);
      });

      if (existing) {
        setSelectedConversationId(existing.conversation.id);
      } else {
        try {
          const conversation = await createConversationFromUsers(profile, [member.uid]);
          setSelectedConversationId(conversation.id);
        } catch (err) {
          setError((err as Error).message || "Falha ao criar conversa.");
        }
      }

      setIsSpotlightOpen(false);
    },
    [profile, conversations]
  );

  const setTypingState = useCallback(
    async (nextValue: boolean) => {
      if (!profile || !selectedConversation) return;
      if (isTypingFlagRef.current === nextValue) return;

      isTypingFlagRef.current = nextValue;
      const rtdb = await getRealtimeDb();
      await set(ref(rtdb, `typing/${selectedConversation.conversation.id}/${profile.uid}`), nextValue);
    },
    [profile, selectedConversation]
  );

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value.slice(0, CHAT_MESSAGE_MAX_CHARS));

      if (!selectedConversation) return;

      void setTypingState(true);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        void setTypingState(false);
      }, 500);
    },
    [selectedConversation, setTypingState]
  );

  const resolveExternalUser = useCallback(async (email: string): Promise<ChatUserProfile | null> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !isValidEmail(normalized)) return null;

    const fsDb = await getDbRuntime();
    const [byEmail] = await Promise.all([
      getDocs(query(collection(fsDb, "users"), where("email", "==", normalized), limit(1))),
    ]);

    const docSnap = byEmail.docs[0] || null;
    if (!docSnap) return null;

    const data = docSnap.data() as {
      nome?: string;
      email?: string;
      photoURL?: string;
      role?: string;
      estado?: string;
      schoolId?: string;
      escolaId?: string;
    };

    if ((data.estado || "").toLowerCase() === "removido") return null;

    return {
      uid: docSnap.id,
      name: data.nome || "Utilizador",
      email: data.email || normalized,
      photoURL: data.photoURL || "",
      role: data.role === "professor" ? "teacher" : data.role === "tutor" ? "tutor" : data.role === "admin_escolar" ? "admin" : "student",
      orgId: data.schoolId || data.escolaId || null,
    };
  }, []);

  const handleCreateConversation = useCallback(async () => {
    if (!profile) return;

    try {
      setCreatingConversation(true);
      setError("");

      const participantIds = [...selectedMemberIds];
      if (externalEmail.trim()) {
        if (!isValidEmail(externalEmail)) {
          throw new Error("Formato de email inválido. Use formato: nome@dominio.pt");
        }
        const external = await resolveExternalUser(externalEmail);
        if (external && !participantIds.includes(external.uid)) {
          participantIds.push(external.uid);
        } else if (!external) {
          throw new Error("Participante externo não encontrado ou conta removida.");
        }
      }

      if (participantIds.length === 0) {
        throw new Error("Selecione pelo menos um utilizador ou indique email externo válido.");
      }

      const conversation = await createConversationFromUsers(profile, participantIds);
      setSelectedConversationId(conversation.id);
      setIsDmDialogOpen(false);
      setIsGroupDialogOpen(false);
      setSelectedMemberIds([]);
      setExternalEmail("");
      setMemberQuery("");
    } catch (err) {
      setError((err as Error).message || "Falha ao criar conversa.");
    } finally {
      setCreatingConversation(false);
    }
  }, [profile, selectedMemberIds, externalEmail, resolveExternalUser]);

  const handlePickFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);

    if (list.length + selectedFiles.length > CHAT_ATTACHMENTS_MAX_FILES) {
      setError(`No máximo ${CHAT_ATTACHMENTS_MAX_FILES} anexos por mensagem.`);
      return;
    }

    const invalid = list.find((item) => item.size > CHAT_ATTACHMENT_MAX_BYTES);
    if (invalid) {
      setError("Cada anexo deve ter no máximo 8 MB.");
      return;
    }

    setSelectedFiles((prev) => [...prev, ...list]);
    setError("");
  }, [selectedFiles.length]);

  const handleSend = useCallback(async () => {
    if (!profile || !selectedConversation) return;

    const text = draft.trim();
    if (!text && selectedFiles.length === 0) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const now = Date.now();
    const filesToSend = [...selectedFiles];

    setPendingMessages((prev) => [
      ...prev,
      {
        tempId,
        text,
        files: filesToSend,
        createdAt: now,
        deliveryState: "sending",
      },
    ]);

    setDraft("");
    setSelectedFiles([]);
    setError("");
    void setTypingState(false);

    try {
      await sendMessage({
        conversationId: selectedConversation.conversation.id,
        sender: profile,
        text,
        attachments: filesToSend,
        createdAt: now,
      });

      setPendingMessages((prev) => prev.filter((item) => item.tempId !== tempId));
    } catch (err) {
      setPendingMessages((prev) =>
        prev.map((item) =>
          item.tempId === tempId ? { ...item, deliveryState: "failed" } : item
        )
      );
      setError((err as Error).message || "Falha ao enviar mensagem.");
    }
  }, [profile, selectedConversation, draft, selectedFiles, setTypingState]);

  const handleRetryPending = useCallback(async (tempId: string) => {
    const pending = pendingMessages.find((item) => item.tempId === tempId);
    if (!pending || !profile || !selectedConversation) return;

    setPendingMessages((prev) =>
      prev.map((item) =>
        item.tempId === tempId ? { ...item, deliveryState: "sending" } : item
      )
    );

    try {
      await sendMessage({
        conversationId: selectedConversation.conversation.id,
        sender: profile,
        text: pending.text,
        attachments: pending.files,
      });

      setPendingMessages((prev) => prev.filter((item) => item.tempId !== tempId));
    } catch (err) {
      setPendingMessages((prev) =>
        prev.map((item) =>
          item.tempId === tempId ? { ...item, deliveryState: "failed" } : item
        )
      );
      setError((err as Error).message || "Falha ao reenviar mensagem.");
    }
  }, [pendingMessages, profile, selectedConversation]);

  const handleEditMessage = useCallback(async (messageId: string) => {
    if (!selectedConversation || !profile) return;
    try {
      await editMessage({
        conversationId: selectedConversation.conversation.id,
        messageId,
        editorId: profile.uid,
        text: editingText,
      });
      setEditingMessageId("");
      setEditingText("");
    } catch (err) {
      setError((err as Error).message || "Falha ao editar mensagem.");
    }
  }, [selectedConversation, profile, editingText]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!selectedConversation || !profile) return;
    try {
      await deleteMessage({
        conversationId: selectedConversation.conversation.id,
        messageId,
        actorId: profile.uid,
      });
    } catch (err) {
      setError((err as Error).message || "Falha ao apagar mensagem.");
    }
  }, [selectedConversation, profile]);

  const handleRestoreMessage = useCallback(async (messageId: string) => {
    if (!selectedConversation || !profile) return;
    try {
      await restoreDeletedMessage({
        conversationId: selectedConversation.conversation.id,
        messageId,
        actorId: profile.uid,
      });
    } catch (err) {
      setError((err as Error).message || "Falha ao anular eliminação da mensagem.");
    }
  }, [selectedConversation, profile]);

  const handleBlockDirectPeer = useCallback(async () => {
    if (!profile || !directPeer) return;

    try {
      await blockExternalUser({ blocker: profile, target: directPeer });
      setBlockedUsers((prev) => new Set(prev).add(directPeer.uid));
      setError("");
    } catch (err) {
      setError((err as Error).message || "Falha ao bloquear utilizador.");
    }
  }, [profile, directPeer]);

  const handleUnblockDirectPeer = useCallback(async () => {
    if (!profile || !directPeer) return;

    try {
      await unblockUser(profile.uid, directPeer.uid);
      setBlockedUsers((prev) => {
        const next = new Set(prev);
        next.delete(directPeer.uid);
        return next;
      });
      setError("");
    } catch (err) {
      setError((err as Error).message || "Falha ao desbloquear utilizador.");
    }
  }, [profile, directPeer]);

  const handleRemoveConversation = useCallback(
    async (conversationId: string) => {
      if (!profile) return;
      try {
        await removeUserConversation(profile.uid, conversationId);
        setConversations((prev) => prev.filter((item) => item.conversation.id !== conversationId));
        setSelectedConversationId((prev) => (prev === conversationId ? "" : prev));
      } catch {
        // Best-effort.
      }
    },
    [profile]
  );

  const handleReportDirectPeer = useCallback(async () => {
    if (!profile || !directPeer || !selectedConversation) return;

    const lastFromPeer = [...messages]
      .reverse()
      .find((item) => item.senderId === directPeer.uid);

    if (!lastFromPeer) {
      setError("Não há mensagem recente desse utilizador para reportar.");
      return;
    }

    try {
      await reportUserBySpam({
        reportedBy: profile.uid,
        reportedUser: directPeer.uid,
        conversationId: selectedConversation.conversation.id,
        messageId: lastFromPeer.id,
        reason: "spam",
      });
      setError("");
    } catch (err) {
      setError((err as Error).message || "Falha ao reportar utilizador.");
    }
  }, [profile, directPeer, selectedConversation, messages]);

  const handleLoadMore = useCallback(async () => {
    if (!selectedConversation || messages.length === 0) return;

    const oldest = messages[0];
    const older = await loadOlderMessages(selectedConversation.conversation.id, oldest.createdAt, PAGE_SIZE);

    if (older.length === 0) {
      setHasMore(false);
      return;
    }

    setMessages((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const merged = [...older.filter((item) => !existing.has(item.id)), ...prev];
      return merged.sort((a, b) => a.createdAt - b.createdAt);
    });
  }, [messages, selectedConversation]);

  if (loading) {
    return (
      <Card className="flex h-[calc(100svh-4rem)] items-center justify-center text-sm text-muted-foreground">
        A carregar chat...
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="flex h-[calc(100svh-4rem)] items-center justify-center text-sm text-muted-foreground">
        {error || "Faça login para usar o chat."}
      </Card>
    );
  }

  return (
    <div className="flex flex-col -mt-10 -mb-10 -mx-4 sm:-mx-6 lg:-mx-8 h-[calc(100svh-4rem)]">
      <div className="flex flex-1 overflow-hidden border-y border-border bg-background">
        <aside className="hidden md:flex w-[340px] shrink-0 flex-col border-r border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Conversas</p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setMemberQuery("");
                  setSelectedMemberIds([]);
                  setExternalEmail("");
                  setError("");
                  setIsDmDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Iniciar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setMemberQuery("");
                  setSelectedMemberIds([]);
                  setExternalEmail("");
                  setError("");
                  setIsGroupDialogOpen(true);
                }}
              >
                Grupo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setSpotlightQuery("");
                  setSpotlightResults([]);
                  setSpotlightIndex(-1);
                  setIsSpotlightOpen(true);
                }}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => setIsHelpDialogOpen(true)}
              >
                ?
              </Button>
            </div>

            {/* DM Dialog */}
            <Dialog open={isDmDialogOpen} onOpenChange={setIsDmDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Iniciar conversa</DialogTitle>
                  <DialogDescription>
                    Conversa direta com membro interno ou participante externo.
                  </DialogDescription>
                </DialogHeader>

                {profile.orgId ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Pesquisar membro interno</label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Nome ou email"
                          value={memberQuery}
                          onChange={(event) => {
                            setMemberQuery(event.target.value);
                            setSelectedMemberIds([]);
                          }}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                        {memberResults.map((member) => {
                          const selected = selectedMemberIds.includes(member.uid);
                          return (
                            <button
                              key={member.uid}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => setSelectedMemberIds([member.uid])}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={member.photoURL || undefined} alt={member.name} />
                                  <AvatarFallback className="text-[10px]">{initials(member.name)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{member.name}</span>
                                    {shouldShowRole(member.role) ? (
                                      <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                                        {getRoleLabel(member.role)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                                </div>
                              </div>
                              {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                            </button>
                          );
                        })}
                        {memberResults.length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            {memberQuery.trim()
                              ? "Sem resultados internos."
                              : "Sem sugestões. Escreva para pesquisar membros internos."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">Participante externo por email</label>
                      <Input
                        placeholder="email@externo.com"
                        value={externalEmail}
                        onChange={(event) => setExternalEmail(event.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Use email completo. Não há sugestões para externos.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Conversa por email</label>
                    <Input
                      placeholder="email@dominio.com"
                      value={externalEmail}
                      onChange={(event) => setExternalEmail(event.target.value)}
                    />
                  </div>
                )}

                <DialogFooter>
                  {error ? <p className="mr-auto text-xs text-red-500">{error}</p> : null}
                  <Button variant="outline" onClick={() => setIsDmDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={creatingConversation} onClick={handleCreateConversation}>
                    {creatingConversation ? "A criar..." : "Iniciar conversa"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Group Dialog */}
            <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar grupo</DialogTitle>
                  <DialogDescription>
                    Selecionar vários participantes internos e externos.
                  </DialogDescription>
                </DialogHeader>

                {profile.orgId ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Pesquisar membros internos</label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Nome ou email"
                          value={memberQuery}
                          onChange={(event) => setMemberQuery(event.target.value)}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                        {memberResults.map((member) => {
                          const selected = selectedMemberIds.includes(member.uid);
                          return (
                            <button
                              key={member.uid}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() =>
                                setSelectedMemberIds((prev) =>
                                  selected ? prev.filter((id) => id !== member.uid) : [...prev, member.uid]
                                )
                              }
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={member.photoURL || undefined} alt={member.name} />
                                  <AvatarFallback className="text-[10px]">{initials(member.name)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{member.name}</span>
                                    {shouldShowRole(member.role) ? (
                                      <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                                        {getRoleLabel(member.role)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                                </div>
                              </div>
                              {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                            </button>
                          );
                        })}
                        {memberResults.length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            {memberQuery.trim()
                              ? "Sem resultados internos."
                              : "Sem sugestões. Escreva para pesquisar membros internos."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">Participante externo por email completo</label>
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          placeholder="email@externo.com"
                          value={externalEmail}
                          onChange={(event) => setExternalEmail(event.target.value)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!externalEmail.trim()}
                          onClick={async () => {
                            const external = await resolveExternalUser(externalEmail);
                            if (external && !selectedMemberIds.includes(external.uid)) {
                              setSelectedMemberIds((prev) => [...prev, external.uid]);
                              setExternalEmail("");
                            } else if (!external) {
                              setError("Participante externo não encontrado.");
                            }
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    {selectedMemberIds.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Selecionados</label>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedMemberIds.map((uid) => {
                            const m = memberResults.find((r) => r.uid === uid);
                            return (
                              <Badge key={uid} variant="secondary" className="gap-1">
                                {m?.name || uid}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedMemberIds((prev) => prev.filter((id) => id !== uid))
                                  }
                                  aria-label={`Remover ${m?.name || uid}`}
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Participantes por email</label>
                    <Input
                      placeholder="email@dominio.com"
                      value={externalEmail}
                      onChange={(event) => setExternalEmail(event.target.value)}
                    />
                  </div>
                )}

                <DialogFooter>
                  {error ? <p className="mr-auto text-xs text-red-500">{error}</p> : null}
                  <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={creatingConversation} onClick={handleCreateConversation}>
                    {creatingConversation ? "A criar..." : "Criar grupo"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {conversations.map((item) => {
                const conv = item.conversation;
                const ids = Object.keys(conv.participants);
                const peers = ids.filter((uid) => uid !== profile.uid).map((uid) => participantProfiles[uid]).filter(Boolean);
                const title = conv.type === "direct" ? peers[0]?.name || "Mensagem direta" : peers.slice(0, 3).map((p) => p.name).join(", ") || "Grupo";
                const avatarSrc = peers[0]?.photoURL || "";
                const avatarName = peers[0]?.name || title;
                const selected = selectedConversationId === conv.id;

                return (
                  <div key={conv.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={[
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                        selected ? "border-primary/50 bg-primary/10" : "border-transparent hover:bg-muted",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={avatarSrc || undefined} alt={avatarName} />
                          <AvatarFallback className="text-xs">{initials(avatarName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="truncate text-sm font-medium">{title}</p>
                              {conv.type === "direct" && peers[0] && shouldShowRole(peers[0].role) ? (
                                <Badge variant="secondary" className="h-5 px-2 text-[10px] shrink-0">
                                  {getRoleLabel(peers[0].role)}
                                </Badge>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatChatRelativeTime(item.meta.lastMessageAt)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {resolveConversationPreview(item.meta, conv.lastMessage)}
                          </p>
                        </div>
                        {(unreadByConversation[conv.id] || 0) > 0 ? (
                          <Badge className="h-5 min-w-5 justify-center px-1 text-[10px]">
                            {unreadByConversation[conv.id] >= 10 ? "9+" : unreadByConversation[conv.id]}
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={() => handleRemoveConversation(conv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover conversa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

              {conversations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Ainda não há conversas.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden">
          {!selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">Selecione ou crie uma conversa.</p>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{conversationTitle}</p>
                    {isDirect && directPeer ? (
                      deletedAccounts.has(directPeer.uid) ? (
                        <Badge variant="destructive" className="h-5 px-2 text-[10px] shrink-0">
                          Eliminada
                        </Badge>
                      ) : shouldShowRole(directPeer.role) ? (
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] shrink-0">
                          {getRoleLabel(directPeer.role)}
                        </Badge>
                      ) : null
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedConversation.conversation.type === "group"
                      ? `${otherParticipants.length + 1} participantes`
                      : directPeer?.email || "DM"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canShowReportSpam ? (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReportDirectPeer}>
                      <ShieldAlert className="h-4 w-4" />
                      Reportar spam
                    </Button>
                  ) : null}
                  {isDirect && directPeer && !blockedByPeers.has(directPeer.uid) ? (
                    blockedUsers.has(directPeer.uid) ? (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleUnblockDirectPeer}>
                        <UserMinus className="h-4 w-4" />
                        Desbloquear
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBlockDirectPeer}>
                        <UserMinus className="h-4 w-4" />
                        Bloquear
                      </Button>
                    )
                  ) : null}
                </div>
              </header>

              <ScrollArea className="flex-1">
                <div className="mx-auto w-full max-w-4xl p-4">
                  {mergedMessages.length === 0 ? (
                    <div className="flex min-h-full flex-col items-center justify-center gap-3 py-20 text-center">
                      <MessageSquare className="h-12 w-12 opacity-20" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Escreva sua primeira mensagem
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/60">
                          Esta conversa já está pronta. Comece quando quiser.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                  {hasMore ? (
                    <div className="mb-3 flex justify-center">
                      <Button variant="outline" size="sm" onClick={handleLoadMore}>Carregar mais</Button>
                    </div>
                  ) : null}

                  {mergedMessages.map((message, index) => {
                    const author = participantProfiles[message.senderId];
                    const mine = message.senderId === profile.uid;
                    const prev = index > 0 ? mergedMessages[index - 1] : null;
                    const showDivider = !prev || !isSameDay(prev.createdAt, message.createdAt);
                    const sameSenderAsPrev = Boolean(
                      prev &&
                      prev.senderId === message.senderId &&
                      message.createdAt - prev.createdAt <= MESSAGE_SEQUENCE_WINDOW_MS &&
                      isSameDay(prev.createdAt, message.createdAt)
                    );
                    const showAvatar = !mine && !sameSenderAsPrev;
                    const seenByOthers = mine ? hasMessageBeenSeenByOthers(message) : false;
                    const editedMeta = message.deleted ? null : formatEditedMeta(message.editedAt);
                    const showReadReceipt = mine && message.id === lastOwnSentMessageId;
                    const deliveryMeta = showReadReceipt ? getDeliveryMeta(message, seenByOthers) : null;

                    return (
                      <div
                        key={message.id}
                        className={[
                          "space-y-1",
                          sameSenderAsPrev ? "mt-1" : "mt-3",
                        ].join(" ")}
                      >
                        {showDivider ? (
                          <div className="my-4 flex items-center gap-3">
                            <Separator className="flex-1" />
                            <span className="text-xs text-muted-foreground">{formatDayDivider(message.createdAt)}</span>
                            <Separator className="flex-1" />
                          </div>
                        ) : null}

                        <div
                          className={[
                            "flex items-center gap-2 px-1 text-[11px] text-muted-foreground",
                            mine ? "justify-end" : "pl-10 justify-start",
                          ].join(" ")}
                        >
                          {!mine && !sameSenderAsPrev ? (
                            <>
                              <p className="truncate">{author?.name || "Utilizador"}</p>
                              {hasMixedRolesInConversation && shouldShowRole(author?.role || "student") ? (
                                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                                  {getRoleLabel(author?.role || "student")}
                                </Badge>
                              ) : null}
                            </>
                          ) : null}

                          <div className="shrink-0">
                            <span>{formatMessageDateTime(message.createdAt)}</span>
                            {editedMeta ? <span className="ml-2 italic">{editedMeta}</span> : null}
                          </div>
                        </div>

                        <div className={[
                          "group/message flex items-end gap-2",
                          mine ? "justify-end" : "justify-start",
                        ].join(" ")}>
                          {!mine ? (
                            <div className="mt-1 h-8 w-8 shrink-0">
                              {showAvatar ? (
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={author?.photoURL || undefined} alt={author?.name || "Utilizador"} />
                                  <AvatarFallback className="text-xs">{initials(author?.name || "U")}</AvatarFallback>
                                </Avatar>
                              ) : null}
                            </div>
                          ) : null}

                          {mine ? (
                            <div className="relative flex max-w-[82%] flex-col items-end">
                              <div className="rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                                {message.deleted ? (
                                  <p className="italic text-primary-foreground/80">
                                    Mensagem eliminada. {" "}
                                    <button
                                      type="button"
                                      className="font-medium underline underline-offset-2"
                                      onClick={() => handleRestoreMessage(message.id)}
                                    >
                                      Anular
                                    </button>
                                  </p>
                                ) : editingMessageId === message.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editingText}
                                      onChange={(event) => setEditingText(event.target.value.slice(0, CHAT_MESSAGE_MAX_CHARS))}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                          event.preventDefault();
                                          void handleEditMessage(message.id);
                                        }
                                      }}
                                      maxLength={CHAT_MESSAGE_MAX_CHARS}
                                      rows={3}
                                    />
                                    <p className="text-xs text-primary-foreground/75">
                                      Enter guarda. Shift + Enter insere nova linha.
                                    </p>
                                    <div className="flex items-center justify-end gap-2">
                                      <Button size="sm" variant="outline" onClick={() => setEditingMessageId("")}>Cancelar</Button>
                                      <Button size="sm" onClick={() => handleEditMessage(message.id)}>Guardar</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="whitespace-pre-wrap break-words">{message.text || "[Anexo]"}</p>
                                    {Object.values(message.attachments || {}).length > 0 ? (
                                      <div className="mt-2 space-y-1">
                                        {Object.values(message.attachments || {}).map((attachment) => (
                                          <a
                                            key={attachment.id}
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded-md bg-background/20 px-2 py-1 text-xs underline"
                                          >
                                            {attachment.fileName} ({Math.ceil(attachment.size / 1024)} KB)
                                          </a>
                                        ))}
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>

                              {showReadReceipt ? (
                                <div className="mt-1 flex translate-y-1 items-center gap-1 text-[11px] text-muted-foreground">
                                  <span className={deliveryMeta?.className}>{deliveryMeta?.icon}</span>
                                  <span className={deliveryMeta?.className}>{deliveryMeta?.label}</span>
                                </div>
                              ) : null}

                              {message.deliveryState === "sent" && !message.deleted ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <div className="absolute right-1 -top-8 rounded-md border bg-background/95 p-0.5 shadow-sm opacity-0 transition-opacity group-hover/message:opacity-100 data-[state=open]:opacity-100">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        aria-label="Mais opções da mensagem"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" side="top">
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setEditingMessageId(message.id);
                                        setEditingText(message.text || "");
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => handleDeleteMessage(message.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}

                              {message.deliveryState === "failed" ? (
                                <div className="mt-2">
                                  <Button size="sm" variant="outline" onClick={() => handleRetryPending(message.id)}>
                                    Reenviar
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="max-w-[82%] rounded-2xl bg-muted px-3 py-2 text-sm">
                              {message.deleted ? (
                                <p className="italic text-foreground/70">Mensagem eliminada</p>
                              ) : (
                                <>
                                  <p className="whitespace-pre-wrap break-words">{message.text || "[Anexo]"}</p>
                                  {Object.values(message.attachments || {}).length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                      {Object.values(message.attachments || {}).map((attachment) => (
                                        <a
                                          key={attachment.id}
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block rounded-md bg-background/20 px-2 py-1 text-xs underline"
                                        >
                                          {attachment.fileName} ({Math.ceil(attachment.size / 1024)} KB)
                                        </a>
                                      ))}
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={endRef} />
                    </>
                  )}
                </div>
              </ScrollArea>

              <footer className="border-t border-border px-4 py-3">
                {(() => {
                  const peerBlockedMe = isDirect && directPeer && blockedByPeers.has(directPeer.uid);
                  const iBlockedPeer = isDirect && directPeer && blockedUsers.has(directPeer.uid);

                  if (peerBlockedMe) {
                    return (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <UserMinus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Foste bloqueado por este utilizador.</span>
                      </div>
                    );
                  }

                  if (iBlockedPeer) {
                    return (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <span className="text-sm text-muted-foreground">Bloqueaste este utilizador.</span>
                        <Button variant="outline" size="sm" onClick={handleUnblockDirectPeer}>
                          <UserMinus className="h-4 w-4" />
                          Desbloquear
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <>
                {activeTypers.length > 0 ? (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {activeTypers.join(", ")} a escrever...
                  </p>
                ) : null}

                {selectedFiles.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-1">
                        {file.name}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
                          }
                          aria-label={`Remover ${file.name}`}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      handlePickFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Adicionar anexo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  <Input
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    maxLength={CHAT_MESSAGE_MAX_CHARS}
                    placeholder="Escreva uma mensagem"
                  />

                  <Button onClick={() => void handleSend()} disabled={!draft.trim() && selectedFiles.length === 0}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{draft.length}/{CHAT_MESSAGE_MAX_CHARS}</span>
                  <span>Máx. {CHAT_ATTACHMENTS_MAX_FILES} anexos de 8 MB</span>
                </div>

                {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
                    </>
                  );
                })()}
              </footer>
            </>
          )}
        </section>
      </div>

      {/* Help Dialog */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuda do Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">Conversas internas</p>
              <p className="text-muted-foreground">
                Membros elegíveis da mesma escola ou contexto permitido aparecem na pesquisa interna.
              </p>
            </div>
            <div>
              <p className="font-semibold">Participante externo</p>
              <p className="text-muted-foreground">
                Use o campo "Participante externo por email" com o email completo. Não há sugestões
                por username. O email tem de ser de uma conta registada no sistema.
              </p>
            </div>
            <div>
              <p className="font-semibold">Iniciar conversa</p>
              <p className="text-muted-foreground">
                Cria uma conversa direta (1:1). Pesquisa interna em destaque. Também pode adicionar
                um participante externo por email.
              </p>
            </div>
            <div>
              <p className="font-semibold">Criar grupo</p>
              <p className="text-muted-foreground">
                Seleciona vários participantes internos (multi-seleção) e/ou adiciona externos por
                email. Cria uma conversa de grupo.
              </p>
            </div>
            <div>
              <p className="font-semibold">Quem pode falar com quem</p>
              <p className="text-muted-foreground">
                Professores: todos os membros da escola. Alunos: outros alunos, professores e
                administradores da escola. Tutores: apenas participantes dos estágios onde estão
                inseridos. Administradores escolares: todos os membros da escola.
              </p>
            </div>
            <div>
              <p className="font-semibold">Limitações</p>
              <p className="text-muted-foreground">
                Contas removidas/apagadas não aparecem na pesquisa, mas conversas existentes mantêm-se.
                Anexos só permitidos entre membros da mesma organização.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHelpDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spotlight Search Dialog */}
      <Dialog
        open={isSpotlightOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSpotlightQuery("");
            setSpotlightResults([]);
            setSpotlightIndex(-1);
          }
          setIsSpotlightOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Pesquisar utilizador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={spotlightInputRef}
                className="h-11 pl-9 text-base"
                placeholder="Procurar utilizador por nome ou email..."
                value={spotlightQuery}
                onChange={(event) => {
                  setSpotlightQuery(event.target.value);
                  setSpotlightIndex(-1);
                }}
                onKeyDown={handleSpotlightKeyDown}
              />
            </div>

            <ScrollArea className="max-h-80">
              {spotlightResults.map((member, index) => (
                <button
                  key={member.uid}
                  type="button"
                  className={[
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    index === spotlightIndex ? "bg-muted" : "hover:bg-muted/50",
                  ].join(" ")}
                  onClick={() => handleSpotlightSelect(member)}
                  onMouseEnter={() => setSpotlightIndex(index)}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.photoURL || undefined} alt={member.name} />
                    <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{member.name}</span>
                      {shouldShowRole(member.role) ? (
                        <Badge variant="secondary" className="h-5 shrink-0 px-2 text-[10px]">
                          {getRoleLabel(member.role)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </button>
              ))}
              {spotlightQuery.trim() && spotlightResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum utilizador encontrado.
                </p>
              ) : null}
              {!spotlightQuery.trim() ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Escreva o nome ou email para pesquisar.
                </p>
              ) : null}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
