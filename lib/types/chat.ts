export type ChatConversationType = "direct" | "group";

export type ChatRole = "student" | "teacher" | "tutor" | "admin";

export type ChatUserProfile = {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: ChatRole;
  orgId: string | null;
};

export type ChatAttachment = {
  id: string;
  url: string;
  storagePath: string;
  size: number;
  mimeType: string;
  fileName: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string | null;
  attachments: Record<string, ChatAttachment>;
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  seenBy: Record<string, number>;
};

export type ChatConversation = {
  id: string;
  type: ChatConversationType;
  orgId: string | null;
  participants: Record<string, true>;
  lastMessage: {
    text: string | null;
    senderId: string;
    createdAt: number;
    hasAttachments: boolean;
  };
  createdAt: number;
  updatedAt: number;
};

export type UserConversationMeta = {
  lastMessageText: string | null;
  lastMessageAt: number;
  unreadCount: number;
  isMuted: boolean;
};

export type MessageDeliveryState = "sending" | "sent" | "failed";

export type ChatMessageView = ChatMessage & {
  deliveryState: MessageDeliveryState;
  tempId?: string;
};

export type ChatReportReason = "spam" | "abuse" | "other";
