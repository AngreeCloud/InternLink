// To execute these unit tests run:
//    npm run test:unit   # or pnpm run test:unit
// Make sure you have installed dev dependencies (e.g. `npm install` will install
// vitest after it has been added to package.json).  The suite uses Vitest for
// mocking and assertions.

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import path from "path";
import fs from "fs/promises";

// --- mocks ------------------------------------------------
// Mock validators before importing the module-under-test so static imports
// inside `actions/register.ts` are satisfied without needing path-alias
vi.mock("@/lib/validators/register", () => ({
  alunoRegisterActionSchema: { parse: (v: any) => v },
  professorRegisterActionSchema: { parse: (v: any) => v },
  tutorRegisterActionSchema: { parse: (v: any) => v },
}));

// we will import the functions under test after setting up mocks so
// their static imports don't fail during module evaluation
import { registerAluno } from "../../actions/register";

// --- mocks ------------------------------------------------
const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockSendEmailVerification = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUser(...args),
  deleteUser: (...args: any[]) => mockDeleteUser(...args),
  sendEmailVerification: (...args: any[]) => mockSendEmailVerification(...args),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((db: any, ...segments: string[]) => ({ path: segments.join("/") })),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: () => "TIMESTAMP",
}));

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: () => Promise.resolve({}),
  getDbRuntime: () => Promise.resolve({}),
}));

// --- helpers for tests -------------------------------------
function makeAlunoPayload() {
  return {
    nome: "Test Student",
    email: "test@example.com",
    password: "secret123",
    escolaId: "school123",
    escolaNome: "School",
    cursoId: "course456",
    cursoNome: "Course",
    recaptchaToken: undefined,
    dataNascimento: "2000-01-01",
    localidade: "", 
    telefone: "",
  };
}

function makeSchoolSnapshot(data: Record<string, unknown> = {}, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

// Clean firebase debug logs once before and once after this test file runs.
async function cleanDebugLogs() {
  const cwd = process.cwd();
  const names = await fs.readdir(cwd);
  for (const name of names) {
    if (/^firebase-debug.*\.log$/i.test(name)) {
      try {
        await fs.unlink(path.join(cwd, name));
      } catch {
        // ignore failures
      }
    }
  }
}

beforeAll(async () => {
  await cleanDebugLogs();
});

afterAll(async () => {
  await cleanDebugLogs();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDoc.mockResolvedValue(makeSchoolSnapshot({}, false));
});

// --- test cases -------------------------------------------
describe("registerAluno action", () => {
  it("creates auth account and firestore document on success", async () => {
    // arrange: make createUser return a fake user credential
    mockCreateUser.mockResolvedValue({
      user: { uid: "uid-1", email: "test@example.com", metadata: { creationTime: "now" } },
    });
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requireInstitutionalEmail: true, emailDomain: "@example.com" }, true)
    );
    mockSetDoc.mockResolvedValue(undefined);

    const result = await registerAluno(makeAlunoPayload());

    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
    expect(result.uid).toBe("uid-1");
  });

  it("propagates error when firestore write fails after auth creation", async () => {
    // arrange: make createUser return a fake user credential so the action
    // proceeds to the Firestore write before failing
    mockCreateUser.mockResolvedValue({
      user: { uid: "uid-2", email: "test@example.com", metadata: { creationTime: "now" } },
    });
    mockDeleteUser.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requireInstitutionalEmail: true, emailDomain: "example.com" }, true)
    );
    // simulate failure when writing the user document to Firestore
    mockSetDoc.mockRejectedValue(new Error("firestore error"));
    // we expect the action to reject with the Firestore error, and we also
    // verify that the auth account creation was attempted (which currently
    // happens before the Firestore write in the implementation)
    await expect(registerAluno(makeAlunoPayload())).rejects.toThrow("firestore error");
    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
  });

  it("rejects non-school email when institutional domain is required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requireInstitutionalEmail: true, emailDomain: "@school.pt" }, true)
    );

    const payload = {
      ...makeAlunoPayload(),
      email: "student@gmail.com",
    };

    await expect(registerAluno(payload)).rejects.toThrow("Esta escola exige email institucional");
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
