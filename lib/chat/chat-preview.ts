type UserConversationMetaLike = {
  lastMessageText?: string | null;
};

type ConversationLastMessageLike = {
  text?: string | null;
  hasAttachments?: boolean;
};

const LEGACY_DELETED_PREVIEW = "A mensagem foi apagada";
const NORMALIZED_DELETED_PREVIEW = "Mensagem eliminada";

export function resolveConversationPreview(
  meta: UserConversationMetaLike,
  lastMessage?: ConversationLastMessageLike | null
): string {
  const metaText = typeof meta.lastMessageText === "string" ? meta.lastMessageText.trim() : "";
  const conversationText = typeof lastMessage?.text === "string" ? lastMessage.text.trim() : "";
  const conversationIndicatesDeleted =
    conversationText === LEGACY_DELETED_PREVIEW ||
    conversationText === NORMALIZED_DELETED_PREVIEW;
  if (conversationIndicatesDeleted) {
    return NORMALIZED_DELETED_PREVIEW;
  }

  const candidate = metaText || conversationText;

  if (candidate === LEGACY_DELETED_PREVIEW || candidate === NORMALIZED_DELETED_PREVIEW) {
    return NORMALIZED_DELETED_PREVIEW;
  }

  if (candidate) return candidate;

  if (lastMessage?.hasAttachments) {
    return "[Anexo]";
  }

  return "Sem mensagens";
}
