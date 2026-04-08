import {
  child,
  endAt,
  get,
  getDatabase,
  limitToLast,
  off,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
  type DataSnapshot,
  type Database,
} from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query as fsQuery,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { getAuthRuntime, getDbRuntime, getStorageRuntime } from "@/lib/firebase-runtime";
import type {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatReportReason,
  ChatRole,
  ChatUserProfile,
  UserConversationMeta,
} from "@/lib/types/chat";

export const CHAT_MESSAGE_MAX_CHARS = 2000;
export const CHAT_ATTACHMENTS_MAX_FILES = 3;
export const CHAT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const CHAT_DELETED_MESSAGE_PREVIEW = "Mensagem eliminada";

const DAY_MS = 24 * 60 * 60 * 1000;

type OrgMemberIndexEntry = {
  name: string;
  email: string;
  role: ChatRole;
};

type OrgMemberSyncState = {
  signature: string;
  syncedAt: number;
};

type UserSchoolFields = {
  schoolId?: string;
  escolaId?: string;
};

let dbInstance: Database | null = null;
const orgMemberSyncInFlight = new Map<string, Promise<void>>();
const orgMemberSyncState = new Map<string, OrgMemberSyncState>();
const ORG_MEMBER_SYNC_TTL_MS = 15_000;

function sanitizeText(text: string): string {
  return text.trim().slice(0, CHAT_MESSAGE_MAX_CHARS);
}

function nowTs(): number {
  return Date.now();
}

function getOrgIdFromUserData(data: UserSchoolFields): string | null {
  return data.schoolId || data.escolaId || null;
}

function buildOrgMemberSyncKey(orgId: string, userId: string): string {
  return `${orgId}:${userId}`;
}

function buildOrgMemberSignature(entry: OrgMemberIndexEntry): string {
  return `${entry.name}|${entry.email}|${entry.role}`;
}

async function syncOrgMemberIndexEntry(
  orgId: string,
  userId: string,
  entry: OrgMemberIndexEntry
): Promise<void> {
  const key = buildOrgMemberSyncKey(orgId, userId);
  const now = nowTs();
  const signature = buildOrgMemberSignature(entry);
  const previous = orgMemberSyncState.get(key);

  if (
    previous &&
    previous.signature === signature &&
    now - previous.syncedAt < ORG_MEMBER_SYNC_TTL_MS
  ) {
    return;
  }

  const pending = orgMemberSyncInFlight.get(key);
  if (pending) {
    await pending;
    return;
  }

  const writePromise = (async () => {
    const rtdb = await getRealtimeDb();
    await set(ref(rtdb, `orgMembers/${orgId}/${userId}`), entry);
    orgMemberSyncState.set(key, {
      signature,
      syncedAt: nowTs(),
    });
  })();

  orgMemberSyncInFlight.set(key, writePromise);
  try {
    await writePromise;
  } finally {
    orgMemberSyncInFlight.delete(key);
  }
}

function toChatRole(role: string | undefined): ChatRole {
  switch ((role || "").toLowerCase()) {
    case "aluno":
      return "student";
    case "professor":
      return "teacher";
    case "admin_escolar":
      return "admin";
    case "tutor":
      return "tutor";
    default:
      return "student";
  }
}

function mapConversation(snapshot: DataSnapshot): ChatConversation {
  const value = snapshot.val() as Omit<ChatConversation, "id">;
  return {
    id: snapshot.key || "",
    ...value,
  };
}

function mapMessage(snapshot: DataSnapshot): ChatMessage {
  const value = snapshot.val() as Omit<ChatMessage, "id">;
  return {
    id: snapshot.key || "",
    senderId: value.senderId,
    text: value.text ?? null,
    attachments: value.attachments || {},
    createdAt: value.createdAt,
    editedAt: value.editedAt ?? null,
    deleted: Boolean(value.deleted),
    deletedAt: value.deletedAt ?? null,
    seenBy: value.seenBy || {},
  };
}

export async function getRealtimeDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  await getAuthRuntime();
  const appDb = getDatabase();
  dbInstance = appDb;
  return appDb;
}

export async function getCurrentChatProfile(): Promise<ChatUserProfile | null> {
  const auth = await getAuthRuntime();
  const user = auth.currentUser;
  if (!user) return null;

  const db = await getDbRuntime();
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;

  const data = snap.data() as {
    nome?: string;
    name?: string;
    email?: string;
    photoURL?: string;
    role?: string;
    schoolId?: string;
    escolaId?: string;
  };

  return {
    uid: user.uid,
    name: data.nome || data.name || user.displayName || "Utilizador",
    email: data.email || user.email || "",
    photoURL: data.photoURL || user.photoURL || "",
    role: toChatRole(data.role),
    orgId: getOrgIdFromUserData(data),
  };
}

export async function ensureOrgMemberIndex(profile: ChatUserProfile): Promise<void> {
  if (!profile.orgId) return;
  await syncOrgMemberIndexEntry(profile.orgId, profile.uid, {
    name: profile.name,
    email: profile.email,
    role: profile.role,
  });
}

export async function ensureOrgMemberIndexByUserId(userId: string): Promise<void> {
  const fsDb = await getDbRuntime();
  const snap = await getDoc(doc(fsDb, "users", userId));
  if (!snap.exists()) return;

  const data = snap.data() as {
    nome?: string;
    name?: string;
    email?: string;
    photoURL?: string;
    role?: string;
    schoolId?: string;
    escolaId?: string;
  };

  const orgId = getOrgIdFromUserData(data);
  if (!orgId) return;

  await ensureOrgMemberIndex({
    uid: userId,
    name: data.nome || data.name || "Utilizador",
    email: data.email || "",
    photoURL: data.photoURL || "",
    role: toChatRole(data.role),
    orgId,
  });
}

export async function searchInternalMembers(
  orgId: string | null,
  queryText: string,
  currentUserId: string,
  currentUserRole?: ChatRole
): Promise<Array<ChatUserProfile>> {
  const term = queryText.trim().toLowerCase();
  const merged = new Map<string, ChatUserProfile>();

  if (orgId) {
    try {
      const fsDb = await getDbRuntime();
      const [usersBySchoolId, usersByEscolaId] = await Promise.all([
        getDocs(fsQuery(collection(fsDb, "users"), where("schoolId", "==", orgId))),
        getDocs(fsQuery(collection(fsDb, "users"), where("escolaId", "==", orgId))),
      ]);

      const mergedDocs = new Map<string, (typeof usersBySchoolId.docs)[number]>();
      for (const docSnap of usersBySchoolId.docs) mergedDocs.set(docSnap.id, docSnap);
      for (const docSnap of usersByEscolaId.docs) mergedDocs.set(docSnap.id, docSnap);

      for (const docSnap of Array.from(mergedDocs.values())) {
        const data = docSnap.data() as {
          nome?: string;
          name?: string;
          email?: string;
          photoURL?: string;
          role?: string;
          estado?: string;
          schoolId?: string;
          escolaId?: string;
        };

        if (docSnap.id === currentUserId) continue;

        const rawEstado = (data.estado || "").toLowerCase();
        if (rawEstado && rawEstado !== "ativo") continue;

        const profileOrgId = getOrgIdFromUserData(data);
        if (profileOrgId !== orgId) continue;

        const profile: ChatUserProfile = {
          uid: docSnap.id,
          name: data.nome || data.name || "Utilizador",
          email: data.email || "",
          photoURL: data.photoURL || "",
          role: toChatRole(data.role),
          orgId: profileOrgId,
        };

        merged.set(profile.uid, profile);
      }
    } catch {
      // Ignore Firestore search errors; fallback paths may still return useful candidates.
    }

    try {
      const rtdb = await getRealtimeDb();
      const membersSnap = await get(ref(rtdb, `orgMembers/${orgId}`));
      if (membersSnap.exists()) {
        const members = membersSnap.val() as Record<string, OrgMemberIndexEntry>;
        for (const [uid, member] of Object.entries(members)) {
          if (uid === currentUserId) continue;
          if (merged.has(uid)) continue;

          merged.set(uid, {
            uid,
            name: member.name || "Utilizador",
            email: member.email || "",
            photoURL: "",
            role: member.role || "student",
            orgId,
          });
        }
      }
    } catch {
      // Keep best-effort results from previous sources.
    }
  }

  if (currentUserRole === "student" || currentUserRole === "teacher") {
    try {
      const fsDb = await getDbRuntime();
      const byAluno = currentUserRole === "student"
        ? await getDocs(
            fsQuery(
              collection(fsDb, "estagios"),
              where("alunoId", "==", currentUserId)
            )
          )
        : null;
      const byProfessor = currentUserRole === "teacher"
        ? await getDocs(
            fsQuery(
              collection(fsDb, "estagios"),
              where("professorId", "==", currentUserId)
            )
          )
        : null;

      const tutorIds = new Set<string>();
      const estagiosDocs = [
        ...(byAluno?.docs || []),
        ...(byProfessor?.docs || []),
      ];

      for (const docSnap of estagiosDocs) {
        const data = docSnap.data() as { tutorId?: string };
        if (data.tutorId) tutorIds.add(data.tutorId);
      }

      if (currentUserRole === "student") {
        try {
          const rtdb = await getRealtimeDb();
          const tutorsSnap = await get(ref(rtdb, `userTutors/${currentUserId}`));
          if (tutorsSnap.exists()) {
            Object.keys(tutorsSnap.val() as Record<string, true>).forEach((id) => tutorIds.add(id));
          }
        } catch {
          // Ignore optional relation source.
        }
      }

      if (tutorIds.size > 0) {
        const tutorProfiles = await getChatProfilesByIds(Array.from(tutorIds));
        for (const profile of tutorProfiles) {
          if (profile.uid === currentUserId) continue;
          if (profile.role !== "tutor") continue;
          merged.set(profile.uid, profile);
        }
      }

    } catch {
      // Optional tutor enrichment should not block standard member search.
    }
  }

  return Array.from(merged.values())
    .filter((member) => {
      if (!term) return true;
      return (
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
}

async function getConversation(conversationId: string): Promise<ChatConversation | null> {
  const rtdb = await getRealtimeDb();
  const snap = await get(ref(rtdb, `conversations/${conversationId}`));
  return snap.exists() ? mapConversation(snap) : null;
}

async function isUserBlocked(targetUserId: string, senderId: string): Promise<boolean> {
  try {
    const rtdb = await getRealtimeDb();
    const blockedSnap = await get(ref(rtdb, `userBlocks/${targetUserId}/${senderId}`));
    return blockedSnap.exists() && blockedSnap.val() === true;
  } catch {
    // Do not block message sending due to block-edge read issues.
    return false;
  }
}

async function areTutorAndStudentAssociated(studentId: string, tutorId: string, fsDb: Firestore): Promise<boolean> {
  const rtdb = await getRealtimeDb();
  const relation = await get(ref(rtdb, `userTutors/${studentId}/${tutorId}`));
  if (relation.exists() && relation.val() === true) return true;

  const [byTutorAndStudent, byTutorAndTeacher] = await Promise.all([
    getDocs(
      fsQuery(
        collection(fsDb, "estagios"),
        where("tutorId", "==", tutorId),
        where("alunoId", "==", studentId)
      )
    ),
    getDocs(
      fsQuery(
        collection(fsDb, "estagios"),
        where("tutorId", "==", tutorId),
        where("professorId", "==", studentId)
      )
    ),
  ]);

  return !byTutorAndStudent.empty || !byTutorAndTeacher.empty;
}

async function canSendAttachmentsBetween(
  sender: ChatUserProfile,
  recipient: ChatUserProfile,
  fsDb: Firestore
): Promise<boolean> {
  if (sender.orgId && sender.orgId === recipient.orgId) return true;

  if (sender.role === "tutor" && recipient.role === "student") {
    return areTutorAndStudentAssociated(recipient.uid, sender.uid, fsDb);
  }

  if (sender.role === "student" && recipient.role === "tutor") {
    return areTutorAndStudentAssociated(sender.uid, recipient.uid, fsDb);
  }

  if (sender.role === "teacher" && recipient.role === "tutor") {
    return areTutorAndStudentAssociated(sender.uid, recipient.uid, fsDb);
  }

  if (sender.role === "tutor" && recipient.role === "teacher") {
    return areTutorAndStudentAssociated(recipient.uid, sender.uid, fsDb);
  }

  return false;
}

async function syncChatAccessDoc(conversation: ChatConversation): Promise<void> {
  const fsDb = await getDbRuntime();
  await setDoc(
    doc(fsDb, "chatAccess", conversation.id),
    {
      participants: conversation.participants,
      orgId: conversation.orgId,
      type: conversation.type,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
    },
    { merge: true }
  );
}

async function findExistingDirectConversation(userA: string, userB: string): Promise<ChatConversation | null> {
  const rtdb = await getRealtimeDb();
  const userConvsSnap = await get(ref(rtdb, `userConversations/${userA}`));
  if (!userConvsSnap.exists()) return null;

  const entries = Object.keys(userConvsSnap.val() as Record<string, UserConversationMeta>);
  for (const conversationId of entries) {
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.type !== "direct") continue;
    const participantIds = Object.keys(conversation.participants || {});
    if (participantIds.length === 2 && participantIds.includes(userA) && participantIds.includes(userB)) {
      return conversation;
    }
  }

  return null;
}

export async function getChatProfilesByIds(userIds: string[]): Promise<ChatUserProfile[]> {
  const fsDb = await getDbRuntime();
  const profiles = await Promise.all(
    userIds.map(async (uid) => {
      const snap = await getDoc(doc(fsDb, "users", uid));
      if (!snap.exists()) return null;
      const data = snap.data() as {
        nome?: string;
        name?: string;
        email?: string;
        photoURL?: string;
        role?: string;
        schoolId?: string;
        escolaId?: string;
      };

      return {
        uid,
        name: data.nome || data.name || "Utilizador",
        email: data.email || "",
        photoURL: data.photoURL || "",
        role: toChatRole(data.role),
        orgId: getOrgIdFromUserData(data),
      } satisfies ChatUserProfile;
    })
  );

  return profiles.filter((item): item is ChatUserProfile => Boolean(item));
}

async function expandParticipantsForTutorAutoChannel(
  participants: ChatUserProfile[]
): Promise<ChatUserProfile[]> {
  const hasStudent = participants.some((p) => p.role === "student");
  const hasTeacher = participants.some((p) => p.role === "teacher");
  if (!hasStudent || !hasTeacher) return participants;

  const student = participants.find((p) => p.role === "student");
  if (!student) return participants;

  let tutorsSnap;
  try {
    const rtdb = await getRealtimeDb();
    tutorsSnap = await get(ref(rtdb, `userTutors/${student.uid}`));
  } catch {
    // Auto-expansion is optional. If rules deny reading tutor links,
    // keep the original participant set and continue conversation creation.
    return participants;
  }

  if (!tutorsSnap.exists()) return participants;

  const tutorIds = Object.keys(tutorsSnap.val() as Record<string, true>);
  if (tutorIds.length === 0) return participants;

  const existing = new Set(participants.map((p) => p.uid));
  const tutorProfiles = await getChatProfilesByIds(tutorIds.filter((uid) => !existing.has(uid)));

  return [...participants, ...tutorProfiles.filter((p) => p.role === "tutor")];
}

export async function createConversationFromUsers(
  currentUser: ChatUserProfile,
  selectedUserIds: string[]
): Promise<ChatConversation> {
  const uniqueParticipants = Array.from(new Set([currentUser.uid, ...selectedUserIds]));
  const hydrated = await getChatProfilesByIds(uniqueParticipants);
  const expanded = await expandParticipantsForTutorAutoChannel(hydrated);

  if (expanded.length < 2) {
    throw new Error("A conversa precisa de pelo menos 2 participantes.");
  }

  const isDirect = expanded.length === 2;
  if (isDirect) {
    const existing = await findExistingDirectConversation(expanded[0].uid, expanded[1].uid);
    if (existing) return existing;
  }

  const conversationId = push(ref(await getRealtimeDb(), "conversations")).key;
  if (!conversationId) {
    throw new Error("Não foi possível gerar o identificador da conversa.");
  }

  const participantsMap = expanded.reduce<Record<string, true>>((acc, profile) => {
    acc[profile.uid] = true;
    return acc;
  }, {});

  const participantOrgIds = Array.from(new Set(expanded.map((p) => p.orgId).filter(Boolean)));
  const orgId = participantOrgIds.length === 1 ? participantOrgIds[0] : null;

  const ts = nowTs();
  const conversation: ChatConversation = {
    id: conversationId,
    type: isDirect ? "direct" : "group",
    orgId,
    participants: participantsMap,
    lastMessage: {
      text: null,
      senderId: currentUser.uid,
      createdAt: ts,
      hasAttachments: false,
    },
    createdAt: ts,
    updatedAt: ts,
  };

  const { id: _conversationId, ...conversationPayload } = conversation;

  const rtdb = await getRealtimeDb();
  const updates: Record<string, unknown> = {
    [`conversations/${conversationId}`]: conversationPayload,
  };

  for (const participant of expanded) {
    updates[`userConversations/${participant.uid}/${conversationId}`] = {
      lastMessageText: null,
      lastMessageAt: ts,
      unreadCount: 0,
      isMuted: false,
    } satisfies UserConversationMeta;
  }

  await update(ref(rtdb), updates);
  try {
    await syncChatAccessDoc(conversation);
  } catch {
    // Keep RTDB conversation creation as the source of truth.
    // chatAccess sync is auxiliary and should not block UX.
  }

  return conversation;
}

export async function subscribeUserConversations(
  userId: string,
  onChange: (list: Array<{ conversation: ChatConversation; meta: UserConversationMeta }>) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  const rtdb = await getRealtimeDb();
  const userConversationsRef = ref(rtdb, `userConversations/${userId}`);

  const callback = async (snap: DataSnapshot) => {
    if (!snap.exists()) {
      onChange([]);
      return;
    }

    try {
      const entries = Object.entries(snap.val() as Record<string, UserConversationMeta>);
      const loaded = await Promise.all(
        entries.map(async ([conversationId, meta]) => {
          const convSnap = await get(ref(rtdb, `conversations/${conversationId}`));
          if (!convSnap.exists()) return null;
          return { conversation: mapConversation(convSnap), meta };
        })
      );

      const valid = loaded
        .filter(
          (
            item
          ): item is {
            conversation: ChatConversation;
            meta: UserConversationMeta;
          } => Boolean(item)
        )
        .sort((a, b) => (b.meta.lastMessageAt || 0) - (a.meta.lastMessageAt || 0));

      onChange(valid);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const cancel = onValue(userConversationsRef, callback, (error) => {
    onError?.(error);
  });

  return () => {
    cancel();
    off(userConversationsRef, "value", callback);
  };
}

export async function subscribeConversationMessages(
  conversationId: string,
  pageSize: number,
  onChange: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  const rtdb = await getRealtimeDb();
  const q = query(
    ref(rtdb, `messages/${conversationId}`),
    orderByChild("createdAt"),
    limitToLast(pageSize)
  );

  const callback = (snap: DataSnapshot) => {
    if (!snap.exists()) {
      onChange([]);
      return;
    }

    const list: ChatMessage[] = [];
    snap.forEach((item) => {
      list.push(mapMessage(item));
      return false;
    });

    onChange(list.sort((a, b) => a.createdAt - b.createdAt));
  };

  const cancel = onValue(q, callback, (error) => onError?.(error));
  return () => {
    cancel();
    off(q, "value", callback);
  };
}

export async function loadOlderMessages(
  conversationId: string,
  beforeCreatedAt: number,
  pageSize: number
): Promise<ChatMessage[]> {
  const rtdb = await getRealtimeDb();
  const q = query(
    ref(rtdb, `messages/${conversationId}`),
    orderByChild("createdAt"),
    endAt(beforeCreatedAt - 1),
    limitToLast(pageSize)
  );

  const snap = await get(q);
  if (!snap.exists()) return [];

  const list: ChatMessage[] = [];
  snap.forEach((item) => {
    list.push(mapMessage(item));
    return false;
  });

  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function markConversationSeen(
  conversationId: string,
  userId: string,
  newestMessage: ChatMessage | null
): Promise<void> {
  if (!newestMessage) return;

  const rtdb = await getRealtimeDb();
  const seenAt = nowTs();
  const updates: Record<string, unknown> = {
    [`userConversations/${userId}/${conversationId}/unreadCount`]: 0,
    [`userConversations/${userId}/${conversationId}/lastMessageAt`]: newestMessage.createdAt,
    [`userConversations/${userId}/${conversationId}/lastSeenAt`]: seenAt,
    [`conversations/${conversationId}/readState/${userId}`]: seenAt,
  };

  // Avoid scanning entire message history on every open/scroll.
  // Keep a conversation-level marker and only stamp seenBy on the newest incoming message.
  const newestIsIncoming = newestMessage.senderId !== userId;
  const newestSeenByCurrentUser = Boolean(newestMessage.seenBy?.[userId]);
  if (newestIsIncoming && !newestMessage.deleted && !newestSeenByCurrentUser) {
    updates[`messages/${conversationId}/${newestMessage.id}/seenBy/${userId}`] = seenAt;
  }

  await update(ref(rtdb), updates);
}

async function uploadAttachments(
  storage: FirebaseStorage,
  conversationId: string,
  messageId: string,
  files: File[]
): Promise<Record<string, ChatAttachment>> {
  const uploaded: Record<string, ChatAttachment> = {};

  for (const file of files) {
    if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
      throw new Error("Cada anexo deve ter no máximo 8 MB.");
    }

    const attachmentId = crypto.randomUUID();
    const path = `chat-attachments/${conversationId}/${messageId}/${attachmentId}/${file.name}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, file, {
      contentType: file.type || "application/octet-stream",
    });

    const url = await getDownloadURL(fileRef);

    uploaded[attachmentId] = {
      id: attachmentId,
      url,
      storagePath: path,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
    };
  }

  return uploaded;
}

async function incrementUnreadForParticipants(
  conversationId: string,
  participants: string[],
  senderId: string
): Promise<void> {
  const rtdb = await getRealtimeDb();

  await Promise.all(
    participants.map(async (participantId) => {
      try {
        if (participantId === senderId) {
          await update(ref(rtdb), {
            [`userConversations/${participantId}/${conversationId}/unreadCount`]: 0,
          });
          return;
        }

        await runTransaction(
          ref(rtdb, `userConversations/${participantId}/${conversationId}/unreadCount`),
          (currentValue) => {
            const value = Number(currentValue || 0);
            return value + 1;
          }
        );
      } catch {
        // Keep message delivery successful even if unread counter sync fails for one participant.
      }
    })
  );
}

export async function sendMessage(params: {
  conversationId: string;
  sender: ChatUserProfile;
  text: string;
  attachments: File[];
}): Promise<ChatMessage> {
  const { conversationId, sender, text, attachments } = params;
  const messageText = sanitizeText(text || "");

  if (!messageText && attachments.length === 0) {
    throw new Error("A mensagem não pode estar vazia.");
  }

  if (messageText.length > CHAT_MESSAGE_MAX_CHARS) {
    throw new Error("A mensagem excede o limite de 2000 caracteres.");
  }

  if (attachments.length > CHAT_ATTACHMENTS_MAX_FILES) {
    throw new Error("Pode enviar no máximo 3 anexos por mensagem.");
  }

  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error("Conversa não encontrada.");
  }

  if (!conversation.participants[sender.uid]) {
    throw new Error("Não tem permissão para enviar nesta conversa.");
  }

  const participantIds = Object.keys(conversation.participants);
  const fsDb = await getDbRuntime();

  const recipients = await getChatProfilesByIds(participantIds.filter((uid) => uid !== sender.uid));

  for (const recipient of recipients) {
    if (await isUserBlocked(recipient.uid, sender.uid)) {
      throw new Error("Este utilizador bloqueou o seu contacto.");
    }
  }

  if (attachments.length > 0) {
    for (const recipient of recipients) {
      const allowed = await canSendAttachmentsBetween(sender, recipient, fsDb);
      if (!allowed) {
        throw new Error(
          "Anexos só são permitidos entre membros da mesma organização ou tutor associado."
        );
      }
    }
  }

  const rtdb = await getRealtimeDb();
  const messageRef = push(ref(rtdb, `messages/${conversationId}`));
  const messageId = messageRef.key;
  if (!messageId) {
    throw new Error("Não foi possível criar a mensagem.");
  }

  const storage = await getStorageRuntime();
  const uploadedAttachments = await uploadAttachments(storage, conversationId, messageId, attachments);

  const createdAt = nowTs();

  const message: ChatMessage = {
    id: messageId,
    senderId: sender.uid,
    text: messageText || null,
    attachments: uploadedAttachments,
    createdAt,
    editedAt: null,
    deleted: false,
    deletedAt: null,
    seenBy: {
      [sender.uid]: createdAt,
    },
  };

  const lastMessageText = message.text || (Object.keys(uploadedAttachments).length > 0 ? "[Anexo]" : null);
  const hasAttachments = Object.keys(uploadedAttachments).length > 0;

  const updates: Record<string, unknown> = {
    [`messages/${conversationId}/${messageId}`]: {
      senderId: message.senderId,
      text: message.text,
      attachments: hasAttachments ? message.attachments : null,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deleted: message.deleted,
      deletedAt: message.deletedAt,
      seenBy: message.seenBy,
    },
    [`conversations/${conversationId}/lastMessage`]: {
      text: lastMessageText,
      senderId: sender.uid,
      createdAt,
      hasAttachments,
    },
    [`conversations/${conversationId}/updatedAt`]: createdAt,
  };

  await update(ref(rtdb), updates);

  await Promise.all(
    participantIds.map(async (participantId) => {
      try {
        await update(ref(rtdb, `userConversations/${participantId}/${conversationId}`), {
          lastMessageText,
          lastMessageAt: createdAt,
        });
      } catch {
        // Keep message delivery successful even if userConversations metadata sync fails.
      }
    })
  );

  await incrementUnreadForParticipants(conversationId, participantIds, sender.uid);

  return message;
}

export async function editMessage(params: {
  conversationId: string;
  messageId: string;
  editorId: string;
  text: string;
}): Promise<void> {
  const newText = sanitizeText(params.text || "");
  if (!newText) {
    throw new Error("A mensagem editada não pode ficar vazia.");
  }

  const rtdb = await getRealtimeDb();
  const msgSnap = await get(ref(rtdb, `messages/${params.conversationId}/${params.messageId}`));
  if (!msgSnap.exists()) throw new Error("Mensagem não encontrada.");

  const msg = msgSnap.val() as ChatMessage;
  if (msg.senderId !== params.editorId) {
    throw new Error("Só o autor pode editar esta mensagem.");
  }

  if (msg.deleted) {
    throw new Error("Não pode editar uma mensagem apagada.");
  }

  const conversationSnap = await get(ref(rtdb, `conversations/${params.conversationId}`));
  const participants = conversationSnap.exists()
    ? Object.keys(((conversationSnap.val() as { participants?: Record<string, true> })?.participants) || {})
    : [];

  const updates: Record<string, unknown> = {
    [`messages/${params.conversationId}/${params.messageId}/text`]: newText,
    [`messages/${params.conversationId}/${params.messageId}/editedAt`]: nowTs(),
    [`conversations/${params.conversationId}/lastMessage/text`]: newText,
    [`conversations/${params.conversationId}/updatedAt`]: nowTs(),
  };

  for (const participantId of participants) {
    updates[`userConversations/${participantId}/${params.conversationId}/lastMessageText`] = newText;
  }

  await update(ref(rtdb), updates);
}

export async function deleteMessage(params: {
  conversationId: string;
  messageId: string;
  actorId: string;
}): Promise<void> {
  const rtdb = await getRealtimeDb();
  const msgSnap = await get(ref(rtdb, `messages/${params.conversationId}/${params.messageId}`));
  if (!msgSnap.exists()) throw new Error("Mensagem não encontrada.");

  const msg = msgSnap.val() as ChatMessage;
  if (msg.senderId !== params.actorId) {
    throw new Error("Só o autor pode apagar esta mensagem.");
  }

  if (msg.deleted) return;

  const conversationSnap = await get(ref(rtdb, `conversations/${params.conversationId}`));
  const participants = conversationSnap.exists()
    ? Object.keys(((conversationSnap.val() as { participants?: Record<string, true> })?.participants) || {})
    : [];

  const deletedAt = nowTs();

  const updates: Record<string, unknown> = {
    [`messages/${params.conversationId}/${params.messageId}/deleted`]: true,
    [`messages/${params.conversationId}/${params.messageId}/deletedAt`]: deletedAt,
    [`conversations/${params.conversationId}/lastMessage/text`]: CHAT_DELETED_MESSAGE_PREVIEW,
    [`conversations/${params.conversationId}/updatedAt`]: deletedAt,
  };

  for (const participantId of participants) {
    updates[`userConversations/${participantId}/${params.conversationId}/lastMessageText`] =
      CHAT_DELETED_MESSAGE_PREVIEW;
  }

  await update(ref(rtdb), updates);
}

export async function restoreDeletedMessage(params: {
  conversationId: string;
  messageId: string;
  actorId: string;
}): Promise<void> {
  const rtdb = await getRealtimeDb();
  const msgSnap = await get(ref(rtdb, `messages/${params.conversationId}/${params.messageId}`));
  if (!msgSnap.exists()) throw new Error("Mensagem não encontrada.");

  const msg = msgSnap.val() as ChatMessage;
  if (msg.senderId !== params.actorId) {
    throw new Error("Só o autor pode anular a eliminação desta mensagem.");
  }

  if (!msg.deleted) return;

  const conversationSnap = await get(ref(rtdb, `conversations/${params.conversationId}`));
  const participants = conversationSnap.exists()
    ? Object.keys(((conversationSnap.val() as { participants?: Record<string, true> })?.participants) || {})
    : [];

  const hasAttachments = Object.keys(msg.attachments || {}).length > 0;
  const restoredText = msg.text || (hasAttachments ? "[Anexo]" : null);
  const updatedAt = nowTs();

  const updates: Record<string, unknown> = {
    [`messages/${params.conversationId}/${params.messageId}/deleted`]: false,
    [`messages/${params.conversationId}/${params.messageId}/deletedAt`]: null,
    [`conversations/${params.conversationId}/lastMessage/text`]: restoredText,
    [`conversations/${params.conversationId}/updatedAt`]: updatedAt,
  };

  for (const participantId of participants) {
    updates[`userConversations/${participantId}/${params.conversationId}/lastMessageText`] = restoredText;
  }

  await update(ref(rtdb), updates);
}

export async function blockExternalUser(params: {
  blocker: ChatUserProfile;
  target: ChatUserProfile;
}): Promise<void> {
  const { blocker, target } = params;

  if (blocker.orgId && blocker.orgId === target.orgId) {
    throw new Error("Não pode bloquear membros internos da organização.");
  }

  const fsDb = await getDbRuntime();
  const isTutorAssociated =
    (blocker.role === "student" && target.role === "tutor" && (await areTutorAndStudentAssociated(blocker.uid, target.uid, fsDb))) ||
    (blocker.role === "teacher" && target.role === "tutor" && (await areTutorAndStudentAssociated(blocker.uid, target.uid, fsDb)));

  if (isTutorAssociated) {
    throw new Error("Não pode bloquear tutores associados.");
  }

  const rtdb = await getRealtimeDb();
  await set(ref(rtdb, `userBlocks/${blocker.uid}/${target.uid}`), true);
}

export async function unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
  const rtdb = await getRealtimeDb();
  await set(ref(rtdb, `userBlocks/${blockerId}/${blockedUserId}`), null);
}

export async function reportUserBySpam(params: {
  reportedBy: string;
  reportedUser: string;
  conversationId: string;
  messageId: string;
  reason?: ChatReportReason;
}): Promise<void> {
  const rtdb = await getRealtimeDb();
  const reportRef = push(ref(rtdb, "reports"));
  await set(reportRef, {
    reportedBy: params.reportedBy,
    reportedUser: params.reportedUser,
    conversationId: params.conversationId,
    messageId: params.messageId,
    reason: params.reason || "spam",
    createdAt: nowTs(),
  });
}

export function formatChatRelativeTime(timestamp: number): string {
  const deltaMs = nowTs() - timestamp;

  if (deltaMs < 1000) return "1s";
  if (deltaMs < 60 * 1000) return `${Math.max(1, Math.floor(deltaMs / 1000))}s`;
  if (deltaMs < 60 * 60 * 1000) return `${Math.floor(deltaMs / (60 * 1000))}min`;
  if (deltaMs < DAY_MS) return `${Math.floor(deltaMs / (60 * 60 * 1000))}h`;
  if (deltaMs < 3 * DAY_MS) return `${Math.floor(deltaMs / DAY_MS)}d`;

  return new Date(timestamp).toLocaleDateString("pt-PT");
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
