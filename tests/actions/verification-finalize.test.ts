import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockServerTimestamp = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

import { finalizePendingRegistration } from "@/lib/verification";

function makeSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

describe("finalizePendingRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...segments: unknown[]) => ({ path: segments.map(String).join("/") }));
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockServerTimestamp.mockReturnValue("ts");
  });

  it("returns tutor estado ativo after markEmailVerified on existing users doc", async () => {
    mockGetDoc.mockResolvedValueOnce(makeSnapshot({ role: "tutor", estado: "inativo", schoolId: "school-1" }));

    const result = await finalizePendingRegistration({} as never, "uid-tutor", {
      markEmailVerified: true,
    });

    expect(result).toEqual({ role: "tutor", estado: "ativo", schoolId: "school-1" });
    expect(mockSetDoc).toHaveBeenCalled();
    expect(mockSetDoc.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ estado: "ativo", emailVerified: true }));
    expect(mockSetDoc.mock.calls[0]?.[2]).toEqual({ merge: true });
  });

  it("returns tutor estado ativo after markEmailVerified on pendingRegistrations fallback", async () => {
    mockGetDoc
      .mockResolvedValueOnce(makeSnapshot({}, false))
      .mockResolvedValueOnce(makeSnapshot({ role: "tutor", estado: "inativo", schoolId: "school-2" }));

    const result = await finalizePendingRegistration({} as never, "uid-tutor-2", {
      markEmailVerified: true,
    });

    expect(result).toEqual({ role: "tutor", estado: "ativo", schoolId: "school-2" });
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
