"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref, set } from "firebase/database";
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
  loadOlderMessages,
  markConversationSeen,
  reportUserBySpam,
  restoreDeletedMessage,
  searchInternalMembers,
  sendMessage,
  subscribeConversationMessages,
  subscribeUserConversations,
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
  return new Date(timestamp).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<ChatUserProfile[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [externalEmail, setExternalEmail] = useState("");
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

  const mergedMessages = useMemo<ChatMessageView[]>(() => {
    const sent = messages.map((message) => ({ ...message, deliveryState: "sent" as const }));
    const pending = pendingMessages.map((pendingMessage) => ({
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
      return;
    }

    const loaded = await getChatProfilesByIds(Array.from(idSet));
    setParticipantProfiles(
      loaded.reduce<Record<string, ChatUserProfile>>((acc, item) => {
        acc[item.uid] = item;
        return acc;
      }, {})
    );
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

  useEffect(() => {
    if (!isCreateDialogOpen || !profile) return;

    const normalized = memberQuery.trim();
    if (!normalized) {
      setMemberResults(suggestedMembersFromConversations);
      return;
    }

    let canceled = false;
    const timeout = window.setTimeout(async () => {
      const results = await searchInternalMembers(
        profile.orgId ?? null,
        memberQuery,
        profile.uid,
        profile.role
      );

      if (canceled) return;

      const recentSet = new Set(suggestedMembersFromConversations.map((item) => item.uid));
      const recentFirst = [
        ...results.filter((item) => recentSet.has(item.uid)),
        ...results.filter((item) => !recentSet.has(item.uid)),
      ];

      setMemberResults(recentFirst);
    }, 180);

    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [memberQuery, isCreateDialogOpen, profile, suggestedMembersFromConversations]);

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
    const fsDb = await getDbRuntime();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

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
      schoolId?: string;
      escolaId?: string;
    };

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
      const external = await resolveExternalUser(externalEmail);
      if (external && !participantIds.includes(external.uid)) {
        participantIds.push(external.uid);
      }

      if (participantIds.length === 0) {
        throw new Error("Selecione pelo menos um utilizador ou indique email externo válido.");
      }

      const conversation = await createConversationFromUsers(profile, participantIds);
      setSelectedConversationId(conversation.id);
      setIsCreateDialogOpen(false);
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
      setError("");
    } catch (err) {
      setError((err as Error).message || "Falha ao bloquear utilizador.");
    }
  }, [profile, directPeer]);

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

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova conversa</DialogTitle>
                  <DialogDescription>
                    1 pessoa cria DM. 2+ pessoas cria grupo. Pesquisa interna só mostra membros da organização.
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
                              {selected ? <Check className="h-4 w-4" /> : null}
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
                      <label className="text-xs font-medium">Participante externo por email (opcional)</label>
                      <Input
                        placeholder="email@externo.com"
                        value={externalEmail}
                        onChange={(event) => setExternalEmail(event.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">DM por email</label>
                    <Input
                      placeholder="email@dominio.com"
                      value={externalEmail}
                      onChange={(event) => setExternalEmail(event.target.value)}
                    />
                  </div>
                )}

                <DialogFooter>
                  {error ? <p className="mr-auto text-xs text-red-500">{error}</p> : null}
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={creatingConversation} onClick={handleCreateConversation}>
                    {creatingConversation ? "A criar..." : "Criar conversa"}
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
                  <button
                    type="button"
                    key={conv.id}
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
                          <p className="truncate text-sm font-medium">{title}</p>
                          <span className="text-[11px] text-muted-foreground">
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
                  <p className="truncate text-sm font-semibold">{conversationTitle}</p>
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
                  {isDirect && directPeerIsExternal ? (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBlockDirectPeer}>
                      <UserMinus className="h-4 w-4" />
                      Bloquear
                    </Button>
                  ) : null}
                </div>
              </header>

              <ScrollArea className="flex-1">
                <div className="mx-auto w-full max-w-4xl p-4">
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
                </div>
              </ScrollArea>

              <footer className="border-t border-border px-4 py-3">
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
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
