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
import { registerAluno, registerProfessor, registerTutor } from "../../actions/register";

// --- mocks ------------------------------------------------
const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockSendEmailVerification = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();

type RegistrationResult = Awaited<ReturnType<typeof registerAluno>>;

type AuthUserFixture = {
  uid: string;
  email: string;
  metadata: { creationTime: string };
};

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

function makeProfessorPayload() {
  return {
    nome: "Test Professor",
    email: "professor@example.com",
    password: "secret123",
    escolaId: "school123",
    escolaNome: "School",
    recaptchaToken: undefined,
    dataNascimento: "1985-05-10",
    localidade: "Braga",
    telefone: "912345678",
  };
}

function makeTutorPayload() {
  return {
    nome: "Test Tutor",
    email: "tutor@example.com",
    password: "secret123",
    empresa: "Empresa XPTO",
    recaptchaToken: undefined,
    dataNascimento: "1980-03-15",
    localidade: "Porto",
    telefone: "919999999",
  };
}

function makeSchoolSnapshot(data: Record<string, unknown> = {}, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

function makeAuthUser(uid: string, email: string): AuthUserFixture {
  return {
    uid,
    email,
    metadata: { creationTime: "now" },
  };
}

function mockCreateUserSuccess(uid: string, email: string) {
  mockCreateUser.mockResolvedValue({ user: makeAuthUser(uid, email) });
}

function mockPendingRegistrationSuccess() {
  mockSendEmailVerification.mockResolvedValue(undefined);
}

function mockPendingRegistrationFailure(message = "firestore error") {
  mockDeleteUser.mockResolvedValue(undefined);
  mockSetDoc.mockRejectedValue(new Error(message));
}

function mockInstitutionalSchool(emailDomain = "school.pt") {
  mockGetDoc.mockResolvedValue(
    makeSchoolSnapshot({ requireInstitutionalEmail: true, emailDomain }, true)
  );
}

function mockSchoolWithoutInstitutionalDomain() {
  mockGetDoc.mockResolvedValue(makeSchoolSnapshot({ requireInstitutionalEmail: false }, true));
}

function expectPendingRegistration(uid: string, data: Record<string, unknown>) {
  expect(mockSetDoc).toHaveBeenCalledWith(
    expect.objectContaining({ path: `pendingRegistrations/${uid}` }),
    expect.objectContaining(data)
  );
}

function expectUserRegistration(uid: string, data: Record<string, unknown>) {
  expect(mockSetDoc).toHaveBeenCalledWith(
    expect.objectContaining({ path: `users/${uid}` }),
    expect.objectContaining(data)
  );
}

async function expectRollback(action: Promise<unknown>, message = "firestore error") {
  await expect(action).rejects.toThrow(message);
  expect(mockCreateUser).toHaveBeenCalled();
  expect(mockSetDoc).toHaveBeenCalled();
  expect(mockDeleteUser).toHaveBeenCalledTimes(1);
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
  mockSetDoc.mockResolvedValue(undefined);
  mockDeleteUser.mockResolvedValue(undefined);
  mockSendEmailVerification.mockResolvedValue(undefined);
  mockGetDoc.mockResolvedValue(makeSchoolSnapshot({}, false));
});

// --- test cases -------------------------------------------
describe("registerAluno action", () => {
  it("creates auth account and stores pending user document on success", async () => {
    mockCreateUserSuccess("uid-1", "test@example.com");
    mockInstitutionalSchool("@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(makeAlunoPayload());

    expect(mockCreateUser).toHaveBeenCalled();
    expectUserRegistration("uid-1", {
      role: "aluno",
      schoolId: "school123",
      courseId: "course456",
      estado: "pendente",
      emailVerified: false,
    });
    expect(mockSetDoc).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: "pendingRegistrations/uid-1" }),
      expect.anything()
    );
    expect(mockSendEmailVerification).toHaveBeenCalled();
    expect(result.uid).toBe("uid-1");
  });

  it("propagates error when pending registration write fails after auth creation", async () => {
    mockCreateUserSuccess("uid-2", "test@example.com");
    mockInstitutionalSchool("example.com");
    mockPendingRegistrationFailure();

    await expectRollback(registerAluno(makeAlunoPayload()));
  });

  it("rejects non-school email when institutional domain is required", async () => {
    mockInstitutionalSchool("@school.pt");

    const payload = {
      ...makeAlunoPayload(),
      email: "student@gmail.com",
    };

    await expect(registerAluno(payload)).rejects.toThrow("Esta escola exige email institucional");
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("accepts school email when institutional domain is required", async () => {
    mockInstitutionalSchool("@school.pt");
    mockCreateUserSuccess("uid-3", "student@school.pt");
    mockPendingRegistrationSuccess();

    const payload = {
      ...makeAlunoPayload(),
      email: "student@school.pt",
    };

    const result = await registerAluno(payload);
    expect(mockCreateUser).toHaveBeenCalled();
    expectUserRegistration("uid-3", {
      role: "aluno",
      email: "student@school.pt",
      estado: "pendente",
    });
    expect(result.uid).toBe("uid-3");
  });

  it("does not require email domain validation when not configured", async () => {
    mockSchoolWithoutInstitutionalDomain();
    mockCreateUserSuccess("uid-4", "student@gmail.com");
    mockPendingRegistrationSuccess();

    const payload = {
      ...makeAlunoPayload(),
      email: "student@gmail.com",
    };

    const result = await registerAluno(payload);
    expect(mockCreateUser).toHaveBeenCalled();
    expectUserRegistration("uid-4", {
      role: "aluno",
      email: "student@gmail.com",
      estado: "pendente",
    });
    expect(result.uid).toBe("uid-4");
  });
});

describe("registerProfessor action", () => {
  it("creates auth account and stores pending user document on success", async () => {
    mockCreateUserSuccess("prof-1", "professor@school.pt");
    mockInstitutionalSchool("school.pt");
    mockPendingRegistrationSuccess();

    const result: RegistrationResult = await registerProfessor({
      ...makeProfessorPayload(),
      email: "professor@school.pt",
    });

    expect(mockCreateUser).toHaveBeenCalled();
    expectUserRegistration("prof-1", {
      role: "professor",
      schoolId: "school123",
      courseId: null,
      estado: "pendente",
      emailVerified: false,
    });
    expect(mockSetDoc).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: "pendingRegistrations/prof-1" }),
      expect.anything()
    );
    expect(mockSendEmailVerification).toHaveBeenCalled();
    expect(result.uid).toBe("prof-1");
  });

  it("rolls back auth user when pending registration write fails", async () => {
    mockCreateUserSuccess("prof-2", "professor@school.pt");
    mockInstitutionalSchool("school.pt");
    mockPendingRegistrationFailure();

    await expectRollback(
      registerProfessor({
        ...makeProfessorPayload(),
        email: "professor@school.pt",
      })
    );
  });

  it("rejects non-school email when institutional domain is required", async () => {
    mockInstitutionalSchool("school.pt");

    await expect(
      registerProfessor({
        ...makeProfessorPayload(),
        email: "professor@gmail.com",
      })
    ).rejects.toThrow("Esta escola exige email institucional");

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe("registerTutor action", () => {
  it("creates auth account and stores active tutor user document", async () => {
    mockCreateUserSuccess("tutor-1", "tutor@example.com");
    mockPendingRegistrationSuccess();

    const result: RegistrationResult = await registerTutor(makeTutorPayload());

    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/tutor-1" }),
      expect.objectContaining({
        role: "tutor",
        empresa: "Empresa XPTO",
        estado: "ativo",
      })
    );
    expect(mockSetDoc).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: "pendingRegistrations/tutor-1" }),
      expect.anything()
    );
    expect(mockSendEmailVerification).toHaveBeenCalled();
    expect(result.uid).toBe("tutor-1");
  });

  it("stores auth email verification status on tutor user document", async () => {
    mockCreateUser.mockResolvedValue({
      user: {
        ...makeAuthUser("tutor-verified", "tutor@example.com"),
        emailVerified: true,
      },
    });
    mockPendingRegistrationSuccess();

    const result: RegistrationResult = await registerTutor(makeTutorPayload());

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/tutor-verified" }),
      expect.objectContaining({ emailVerified: true })
    );
    expect(mockSendEmailVerification).not.toHaveBeenCalled();
    expect(result.uid).toBe("tutor-verified");
  });

  it("rolls back auth user when tutor user document write fails", async () => {
    mockCreateUserSuccess("tutor-2", "tutor@example.com");
    mockPendingRegistrationFailure();

    await expectRollback(registerTutor(makeTutorPayload()));
  });
});
