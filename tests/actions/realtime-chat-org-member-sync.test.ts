import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthRuntime = vi.fn();
const mockGetDbRuntime = vi.fn();
const mockGetDatabase = vi.fn();
const mockRef = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
  getDbRuntime: (...args: unknown[]) => mockGetDbRuntime(...args),
  getStorageRuntime: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  child: vi.fn(),
  endAt: vi.fn(),
  get: vi.fn(),
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
  limitToLast: vi.fn(),
  off: vi.fn(),
  onValue: vi.fn(() => vi.fn()),
  orderByChild: vi.fn(),
  push: vi.fn(() => ({ key: "msg-1" })),
  query: vi.fn(),
  ref: (...args: unknown[]) => mockRef(...args),
  runTransaction: vi.fn(),
  set: (...args: unknown[]) => mockSet(...args),
  update: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
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

import { ensureOrgMemberIndex, ensureOrgMemberIndexByUserId } from "../../lib/chat/realtime-chat";

beforeEach(() => {
  vi.clearAllMocks();

  mockGetAuthRuntime.mockResolvedValue({ currentUser: { uid: "user-1" } });
  mockGetDbRuntime.mockResolvedValue({ app: "firestore" });
  mockGetDatabase.mockReturnValue({ app: "rtdb" });
  mockRef.mockImplementation((_db: unknown, path?: string) => ({ path: path || "" }));
  mockDoc.mockReturnValue({ path: "users/user-1" });
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({
      nome: "Alice",
      email: "alice@example.com",
      role: "professor",
      schoolId: "school-1",
    }),
  });
  mockSet.mockResolvedValue(undefined);
});

describe("orgMembers index sync", () => {
  it("coalesces concurrent writes for the same org member", async () => {
    mockSet.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 10);
        })
    );

    const profile = {
      uid: "user-1",
      name: "Alice",
      email: "alice@example.com",
      photoURL: "",
      role: "teacher" as const,
      orgId: "school-1",
    };

    const first = ensureOrgMemberIndex(profile);
    const second = ensureOrgMemberIndex(profile);

    await Promise.all([first, second]);

    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate write when direct sync and by-user sync overlap", async () => {
    const profile = {
      uid: "user-2",
      name: "Bruno",
      email: "bruno@example.com",
      photoURL: "",
      role: "teacher" as const,
      orgId: "school-2",
    };

    mockDoc.mockReturnValueOnce({ path: "users/user-2" });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        nome: "Bruno",
        email: "bruno@example.com",
        role: "professor",
        schoolId: "school-2",
      }),
    });

    await Promise.all([
      ensureOrgMemberIndex(profile),
      ensureOrgMemberIndexByUserId("user-2"),
    ]);

    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("skips repeated identical writes in the short dedupe window", async () => {
    const profile = {
      uid: "user-3",
      name: "Carla",
      email: "carla@example.com",
      photoURL: "",
      role: "teacher" as const,
      orgId: "school-3",
    };

    await ensureOrgMemberIndex(profile);
    await ensureOrgMemberIndex(profile);

    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("writes again when org member payload changes", async () => {
    const profile = {
      uid: "user-4",
      name: "Diogo",
      email: "diogo@example.com",
      photoURL: "",
      role: "teacher" as const,
      orgId: "school-4",
    };

    await ensureOrgMemberIndex(profile);
    await ensureOrgMemberIndex({ ...profile, name: "Alice Silva" });

    expect(mockSet).toHaveBeenCalledTimes(2);
  });
});
