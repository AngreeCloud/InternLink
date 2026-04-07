import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDatabase = vi.fn();
const mockRef = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: vi.fn(),
  getDbRuntime: vi.fn(),
  getStorageRuntime: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  child: vi.fn(),
  endAt: vi.fn(),
  get: (...args: unknown[]) => mockGet(...args),
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
  limitToLast: vi.fn(),
  off: vi.fn(),
  onValue: vi.fn(() => vi.fn()),
  orderByChild: vi.fn(),
  push: vi.fn(() => ({ key: "msg-1" })),
  query: vi.fn(),
  ref: (...args: unknown[]) => mockRef(...args),
  runTransaction: vi.fn(),
  set: vi.fn(),
  update: (...args: unknown[]) => mockUpdate(...args),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  where: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

import { deleteMessage, editMessage, restoreDeletedMessage } from "../../lib/chat/realtime-chat";

type MessageSnapshotData = {
  senderId: string;
  text: string | null;
  attachments: Record<string, unknown>;
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  deletedAt: number | null;
  seenBy: Record<string, number>;
};

function makeMessageSnapshot(data: MessageSnapshotData | null) {
  return {
    exists: () => Boolean(data),
    val: () => data,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockGetDatabase.mockReturnValue({ app: "rtdb" });
  mockRef.mockImplementation((_db: unknown, path?: string) => ({ path: path || "" }));
  mockUpdate.mockResolvedValue(undefined);

  mockGet.mockResolvedValue(
    makeMessageSnapshot({
      senderId: "author-1",
      text: "texto original",
      attachments: {},
      createdAt: 1710000000000,
      editedAt: null,
      deleted: false,
      deletedAt: null,
      seenBy: {},
    })
  );
});

describe("message mutations", () => {
  it("edits own message and writes edited metadata", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1710000005000);

    await editMessage({
      conversationId: "conv-1",
      messageId: "msg-1",
      editorId: "author-1",
      text: "  mensagem editada  ",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, payload] = mockUpdate.mock.calls[0] as [{ path: string }, Record<string, unknown>];

    expect(payload).toMatchObject({
      "messages/conv-1/msg-1/text": "mensagem editada",
      "messages/conv-1/msg-1/editedAt": 1710000005000,
      "conversations/conv-1/lastMessage/text": "mensagem editada",
      "conversations/conv-1/updatedAt": 1710000005000,
    });
  });

  it("rejects edit when resulting text is empty", async () => {
    await expect(
      editMessage({
        conversationId: "conv-1",
        messageId: "msg-1",
        editorId: "author-1",
        text: "   ",
      })
    ).rejects.toThrow("A mensagem editada não pode ficar vazia.");

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects edit for deleted message", async () => {
    mockGet.mockResolvedValueOnce(
      makeMessageSnapshot({
        senderId: "author-1",
        text: null,
        attachments: {},
        createdAt: 1710000000000,
        editedAt: 1710000001000,
        deleted: true,
        deletedAt: 1710000002000,
        seenBy: {},
      })
    );

    await expect(
      editMessage({
        conversationId: "conv-1",
        messageId: "msg-1",
        editorId: "author-1",
        text: "novo texto",
      })
    ).rejects.toThrow("Não pode editar uma mensagem apagada.");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("deletes own message and keeps placeholder metadata in conversation", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1710000009000);

    await deleteMessage({
      conversationId: "conv-1",
      messageId: "msg-1",
      actorId: "author-1",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, payload] = mockUpdate.mock.calls[0] as [{ path: string }, Record<string, unknown>];

    expect(payload).toMatchObject({
      "messages/conv-1/msg-1/deleted": true,
      "messages/conv-1/msg-1/deletedAt": 1710000009000,
      "conversations/conv-1/lastMessage/text": "A mensagem foi apagada",
      "conversations/conv-1/updatedAt": 1710000009000,
    });
    expect(payload).not.toHaveProperty("messages/conv-1/msg-1/text");
    expect(payload).not.toHaveProperty("messages/conv-1/msg-1/editedAt");
  });

  it("rejects delete by non-author", async () => {
    await expect(
      deleteMessage({
        conversationId: "conv-1",
        messageId: "msg-1",
        actorId: "other-user",
      })
    ).rejects.toThrow("Só o autor pode apagar esta mensagem.");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("restores own deleted message", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1710000010000);

    mockGet.mockResolvedValueOnce(
      makeMessageSnapshot({
        senderId: "author-1",
        text: "texto antigo",
        attachments: {},
        createdAt: 1710000000000,
        editedAt: 1710000001000,
        deleted: true,
        deletedAt: 1710000009000,
        seenBy: {},
      })
    );

    await restoreDeletedMessage({
      conversationId: "conv-1",
      messageId: "msg-1",
      actorId: "author-1",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, payload] = mockUpdate.mock.calls[0] as [{ path: string }, Record<string, unknown>];

    expect(payload).toMatchObject({
      "messages/conv-1/msg-1/deleted": false,
      "messages/conv-1/msg-1/deletedAt": null,
      "conversations/conv-1/lastMessage/text": "texto antigo",
      "conversations/conv-1/updatedAt": 1710000010000,
    });
  });

  it("rejects restore by non-author", async () => {
    mockGet.mockResolvedValueOnce(
      makeMessageSnapshot({
        senderId: "author-1",
        text: "texto antigo",
        attachments: {},
        createdAt: 1710000000000,
        editedAt: 1710000001000,
        deleted: true,
        deletedAt: 1710000009000,
        seenBy: {},
      })
    );

    await expect(
      restoreDeletedMessage({
        conversationId: "conv-1",
        messageId: "msg-1",
        actorId: "other-user",
      })
    ).rejects.toThrow("Só o autor pode anular a eliminação desta mensagem.");

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
