import { describe, expect, it } from "vitest";
import { resolveConversationPreview } from "@/lib/chat/chat-preview";

describe("resolveConversationPreview", () => {
  it("normalizes legacy deleted preview label", () => {
    expect(
      resolveConversationPreview(
        { lastMessageText: "A mensagem foi apagada" },
        { text: "A mensagem foi apagada" }
      )
    ).toBe("Mensagem eliminada");
  });

  it("uses conversation last message as fallback when meta is stale", () => {
    expect(
      resolveConversationPreview(
        { lastMessageText: "texto antigo" },
        { text: "Mensagem eliminada" }
      )
    ).toBe("Mensagem eliminada");

    expect(
      resolveConversationPreview(
        { lastMessageText: "" },
        { text: "Mensagem eliminada" }
      )
    ).toBe("Mensagem eliminada");
  });

  it("returns attachment placeholder when no text is present", () => {
    expect(resolveConversationPreview({}, { text: null, hasAttachments: true })).toBe("[Anexo]");
  });

  it("returns default empty preview when no signal is available", () => {
    expect(resolveConversationPreview({}, null)).toBe("Sem mensagens");
  });
});
