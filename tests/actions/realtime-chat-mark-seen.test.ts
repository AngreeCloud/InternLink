import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthRuntime = vi.fn();
const mockGetDatabase = vi.fn();
const mockRef = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
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

import { markConversationSeen } from "../../lib/chat/realtime-chat";

beforeEach(() => {
  vi.clearAllMocks();

  mockGetAuthRuntime.mockResolvedValue({ currentUser: { uid: "userA" } });
  mockGetDatabase.mockReturnValue({ app: "rtdb" });
  mockRef.mockImplementation((_db: unknown, path?: string) => ({ path: path || "" }));
  mockUpdate.mockResolvedValue(undefined);
  mockGet.mockResolvedValue({ exists: () => false });
});

describe("markConversationSeen", () => {
  it("writes conversation/user seen markers and newest message seenBy for incoming unseen message", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);

    await markConversationSeen("convA", "userA", {
      id: "msg-10",
      senderId: "userB",
      text: "ola",
      attachments: {},
      createdAt: 1709999999000,
      editedAt: null,
      deleted: false,
      seenBy: {},
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const [, payload] = mockUpdate.mock.calls[0] as [{ path: string }, Record<string, unknown>];

    expect(payload).toMatchObject({
      "userConversations/userA/convA/unreadCount": 0,
      "userConversations/userA/convA/lastMessageAt": 1709999999000,
      "userConversations/userA/convA/lastSeenAt": 1710000000000,
      "conversations/convA/readState/userA": 1710000000000,
      "messages/convA/msg-10/seenBy/userA": 1710000000000,
    });
  });

  it("does not write message-level seenBy when newest message is own or already seen", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1710000005000);

    await markConversationSeen("convA", "userA", {
      id: "msg-11",
      senderId: "userA",
      text: "minha mensagem",
      attachments: {},
      createdAt: 1710000004000,
      editedAt: null,
      deleted: false,
      seenBy: { userA: 1710000004000 },
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const [, payload] = mockUpdate.mock.calls[0] as [{ path: string }, Record<string, unknown>];

    expect(payload).toMatchObject({
      "userConversations/userA/convA/unreadCount": 0,
      "userConversations/userA/convA/lastMessageAt": 1710000004000,
      "userConversations/userA/convA/lastSeenAt": 1710000005000,
      "conversations/convA/readState/userA": 1710000005000,
    });

    expect(payload).not.toHaveProperty("messages/convA/msg-11/seenBy/userA");
  });
});
