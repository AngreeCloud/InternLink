// To execute these unit tests run:
//    npm run test:unit   # or pnpm run test:unit
// Make sure you have installed dev dependencies (e.g. `npm install` will install
// vitest after it has been added to package.json).  The suite uses Vitest for
// mocking and assertions.

import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
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
const mockSendEmailVerification = vi.fn();
const mockSetDoc = vi.fn();

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUser(...args),
  sendEmailVerification: (...args: any[]) => mockSendEmailVerification(...args),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((db: any, col: string, id: string) => ({ path: `${col}/${id}` })),
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

// clean firebase debug logs both before and after the whole file runs
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

beforeEach(async () => {
  await cleanDebugLogs();
});

afterAll(async () => {
  await cleanDebugLogs();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// --- test cases -------------------------------------------
describe("registerAluno action", () => {
  it("creates auth account and firestore document on success", async () => {
    // arrange: make createUser return a fake user credential
    mockCreateUser.mockResolvedValue({
      user: { uid: "uid-1", email: "test@example.com", metadata: { creationTime: "now" } },
    });
    mockSetDoc.mockResolvedValue(undefined);

    const result = await registerAluno(makeAlunoPayload());

    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
    expect(result.uid).toBe("uid-1");
  });

  it("throws when firestore write fails and should not create auth user", async () => {
    // simulate failure after auth creation would normally occur
    mockSetDoc.mockRejectedValue(new Error("firestore error"));

    // we expect the action to reject; the guarantee we want is that
    // createUserWithEmailAndPassword is *not* invoked when firestore fails.
    // Note: the implementation in the main code currently creates the
    // auth user before writing to Firestore, so this expectation will fail
    // until the code is adjusted.  The failing test serves as a warning.
    await expect(registerAluno(makeAlunoPayload())).rejects.toThrow("firestore error");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
