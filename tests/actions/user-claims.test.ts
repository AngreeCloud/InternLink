import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureUserClaims } from "@/lib/auth/custom-claims";

const mockGetUser = vi.fn();
const mockSetCustomUserClaims = vi.fn();
const mockDocGet = vi.fn();

vi.mock("firebase-admin/auth", () => ({}));
vi.mock("firebase-admin/firestore", () => ({}));

const auth = {
  getUser: (...args: unknown[]) => mockGetUser(...args),
  setCustomUserClaims: (...args: unknown[]) => mockSetCustomUserClaims(...args),
} as any;

const db = {
  collection: () => ({
    doc: () => ({
      get: mockDocGet,
    }),
  }),
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureUserClaims", () => {
  it("creates claims when missing", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "professor", estado: "ativo" }),
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: {},
    });

    const result = await ensureUserClaims(auth, db, "uid-1");

    expect(result.updated).toBe(true);
    expect(result.role).toBe("professor");
    expect(result.estado).toBe("ativo");
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", {
      role: "professor",
      estado: "ativo",
    });
  });

  it("updates claims when Firestore changes", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "professor", estado: "ativo" }),
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: { role: "professor", estado: "pendente" },
    });

    const result = await ensureUserClaims(auth, db, "uid-2");

    expect(result.updated).toBe(true);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-2", {
      role: "professor",
      estado: "ativo",
    });
  });

  it("does nothing when claims are already correct", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "aluno", estado: "ativo" }),
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: { role: "aluno", estado: "ativo" },
    });

    const result = await ensureUserClaims(auth, db, "uid-3");

    expect(result.updated).toBe(false);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });
});
