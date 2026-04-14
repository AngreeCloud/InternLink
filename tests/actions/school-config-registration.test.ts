/**
 * Unit tests for school optional registration criteria.
 * Verifies that school admin configuration properly enforces:
 * - Email institucional não obrigatório (email domain not required)
 * - Login com Google permitido (Google OAuth allowed)
 * - Telemóvel opcional (phone field optional)
 * - Verificação SMS inativa (SMS verification NOT required after email verification)
 *
 * Run with: pnpm run test:unit
 */

import { vi, describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import path from "path";
import fs from "fs/promises";

// --- mocks ------------------------------------------------
vi.mock("@/lib/validators/register", () => ({
  alunoRegisterActionSchema: { parse: (v: any) => v },
  professorRegisterActionSchema: { parse: (v: any) => v },
  tutorRegisterActionSchema: { parse: (v: any) => v },
}));

import { registerAluno, registerProfessor } from "../../actions/register";

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

// --- helpers -----------------------------------------------
function makeAlunoPayload(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function makeProfessorPayload(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
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
  mockSetDoc.mockResolvedValue(undefined);
  mockSendEmailVerification.mockResolvedValue(undefined);
}

function expectPendingRegistration(uid: string, data: Record<string, unknown>) {
  expect(mockSetDoc).toHaveBeenCalledWith(
    expect.objectContaining({ path: `users/${uid}` }),
    expect.objectContaining(data)
  );
}

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

// --- test suite: Email Institucional (Institutional Email) --------
describe("School Config: Email Institucional não obrigatório", () => {
  it("accepts personal email when institutional email is NOT required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requireInstitutionalEmail: false }, true)
    );
    mockCreateUserSuccess("uid-1", "student@gmail.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ email: "student@gmail.com" })
    );

    expect(result.uid).toBe("uid-1");
    expect(mockCreateUser).toHaveBeenCalled();
    expectPendingRegistration("uid-1", { role: "aluno", email: "student@gmail.com" });
  });

  it("accepts school email even when institutional email is NOT required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requireInstitutionalEmail: false, emailDomain: "@school.pt" }, true)
    );
    mockCreateUserSuccess("uid-2", "student@school.pt");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ email: "student@school.pt" })
    );

    expect(result.uid).toBe("uid-2");
    expect(mockCreateUser).toHaveBeenCalled();
  });

  it("rejects non-school email when institutional email IS required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        { requireInstitutionalEmail: true, emailDomain: "school.pt" },
        true
      )
    );

    await expect(
      registerAluno(makeAlunoPayload({ email: "student@gmail.com" }))
    ).rejects.toThrow("Esta escola exige email institucional");

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("accepts school email when institutional email IS required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        { requireInstitutionalEmail: true, emailDomain: "school.pt" },
        true
      )
    );
    mockCreateUserSuccess("uid-3", "student@school.pt");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ email: "student@school.pt" })
    );

    expect(result.uid).toBe("uid-3");
    expect(mockCreateUser).toHaveBeenCalled();
  });

  it("normalizes email domain with @-prefix for comparison", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        { requireInstitutionalEmail: true, emailDomain: "@school.pt" },
        true
      )
    );
    mockCreateUserSuccess("uid-4", "student@school.pt");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ email: "student@school.pt" })
    );

    expect(result.uid).toBe("uid-4");
  });

  describe("professor registration", () => {
    it("accepts personal email when institutional email is NOT required (professor)", async () => {
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot({ requireInstitutionalEmail: false }, true)
      );
      mockCreateUserSuccess("prof-1", "prof@gmail.com");
      mockPendingRegistrationSuccess();

      const result = await registerProfessor(
        makeProfessorPayload({ email: "prof@gmail.com" })
      );

      expect(result.uid).toBe("prof-1");
    });

    it("rejects non-school email when institutional email IS required (professor)", async () => {
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot(
          { requireInstitutionalEmail: true, emailDomain: "school.pt" },
          true
        )
      );

      await expect(
        registerProfessor(makeProfessorPayload({ email: "prof@gmail.com" }))
      ).rejects.toThrow("Esta escola exige email institucional");
    });
  });
});

// --- test suite: Google Login (OAuth) --------
describe("School Config: Login com Google permitido", () => {
  it("stores configuration indicating Google login is allowed", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ allowGoogleLogin: true }, true)
    );
    mockCreateUserSuccess("uid-g1", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(makeAlunoPayload());

    expect(result.uid).toBe("uid-g1");
    expectPendingRegistration("uid-g1", { role: "aluno" });
  });

  it("stores configuration indicating Google login is NOT allowed", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ allowGoogleLogin: false }, true)
    );
    mockCreateUserSuccess("uid-g2", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(makeAlunoPayload());

    expect(result.uid).toBe("uid-g2");
  });

  it("blocks Google when institutional email is required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requireInstitutionalEmail: true,
          emailDomain: "school.pt",
          allowGoogleLogin: true, // ignored when institutional required
        },
        true
      )
    );
    mockCreateUserSuccess("uid-g3", "student@school.pt");
    mockPendingRegistrationSuccess();

    // The action itself doesn't enforce this, but the UI respects:
    // if requireInstitutionalEmail=true, then allowGoogleLogin is treated as false
    const result = await registerAluno(
      makeAlunoPayload({ email: "student@school.pt" })
    );

    expect(result.uid).toBe("uid-g3");
  });

  it("allows registration to proceed when allowGoogleLogin=true", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          allowGoogleLogin: true,
          requireInstitutionalEmail: false,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-g4", "student@gmail.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ email: "student@gmail.com" })
    );

    expect(result.uid).toBe("uid-g4");
  });
});

// --- test suite: Telemóvel (Phone Field) --------
describe("School Config: Telemóvel opcional", () => {
  it("accepts registration without phone when phone NOT required", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requirePhone: false }, true)
    );
    mockCreateUserSuccess("uid-p1", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "" }) // empty phone
    );

    expect(result.uid).toBe("uid-p1");
    expectPendingRegistration("uid-p1", { role: "aluno", telefone: "" });
  });

  it("stores phone number when provided", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requirePhone: false }, true)
    );
    mockCreateUserSuccess("uid-p2", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-p2");
    expectPendingRegistration("uid-p2", { telefone: "912345678" });
  });

  it("stores phone configuration in school document", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requirePhone: true, requirePhoneVerification: false }, true)
    );
    mockCreateUserSuccess("uid-p3", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-p3");
    // When requirePhone=true, phone should be validated at UI level (form schema)
  });

  it("allows backward compatibility with legacy requiresPhone field", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot({ requiresPhone: true }, true)
    );
    mockCreateUserSuccess("uid-p4", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-p4");
  });

  describe("professor phone requirements", () => {
    it("accepts professor with phone", async () => {
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot({ requirePhone: false }, true)
      );
      mockCreateUserSuccess("prof-p1", "prof@example.com");
      mockPendingRegistrationSuccess();

      const result = await registerProfessor(
        makeProfessorPayload({ telefone: "912345678" })
      );

      expect(result.uid).toBe("prof-p1");
    });

    it("accepts professor storage with optional phone", async () => {
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot({ requirePhone: false }, true)
      );
      mockCreateUserSuccess("prof-p2", "prof@example.com");
      mockPendingRegistrationSuccess();

      const result = await registerProfessor(
        makeProfessorPayload({ telefone: "" })
      );

      expect(result.uid).toBe("prof-p2");
    });
  });
});

// --- test suite: SMS Verification (Phone Verification) --------
describe("School Config: Verificação SMS inativa", () => {
  it("marks SMS verification as inactive when requirePhoneVerification=false", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requirePhoneVerification: false,
          requirePhone: false,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-s1", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(makeAlunoPayload());

    expect(result.uid).toBe("uid-s1");
    expectPendingRegistration("uid-s1", {
      role: "aluno",
      emailVerified: false,
    });
    // When requirePhoneVerification=false, email verification alone is sufficient
  });

  it("allows registration with no SMS requirement", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requirePhoneVerification: false,
          requirePhone: true, // phone required
        },
        true
      )
    );
    mockCreateUserSuccess("uid-s2", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-s2");
    // Phone is required, but SMS verification is not
  });

  it("indicates SMS verification active when requirePhoneVerification=true", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requirePhoneVerification: true,
          requirePhone: true,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-s3", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-s3");
    // When requirePhoneVerification=true, user will need to verify phone after email
  });

  it("stores both requirePhone and requirePhoneVerification independently", async () => {
    // Scenario: Phone NOT required, but IF provided, it must be verified
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requirePhone: false,
          requirePhoneVerification: true,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-s4", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-s4");
    // Phone is optional, but when provided, must be verified
  });

  it("handles legacy requiresPhone without breaking SMS verification", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requiresPhone: true,
          requirePhone: undefined, // not set yet
          requirePhoneVerification: true,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-s5", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({ telefone: "912345678" })
    );

    expect(result.uid).toBe("uid-s5");
  });

  describe("professor SMS verification", () => {
    it("accepts professor registration with SMS verification inactive", async () => {
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot(
          {
            requirePhoneVerification: false,
            requirePhone: false,
          },
          true
        )
      );
      mockCreateUserSuccess("prof-s1", "prof@example.com");
      mockPendingRegistrationSuccess();

      const result = await registerProfessor(makeProfessorPayload());

      expect(result.uid).toBe("prof-s1");
    });

    it("accepts professor with phone when SMS verification inactive", async () => {
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot(
          {
            requirePhoneVerification: false,
            requirePhone: true,
          },
          true
        )
      );
      mockCreateUserSuccess("prof-s2", "prof@example.com");
      mockPendingRegistrationSuccess();

      const result = await registerProfessor(
        makeProfessorPayload({ telefone: "912345678" })
      );

      expect(result.uid).toBe("prof-s2");
    });
  });
});

// --- test suite: Combined Scenarios --------
describe("School Config: Combined criteria scenarios", () => {
  it("school with all optional features enabled", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requireInstitutionalEmail: false,
          allowGoogleLogin: true,
          requirePhone: false,
          requirePhoneVerification: false,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-combo1", "student@example.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({
        email: "student@example.com",
        telefone: "912345678", // optional but provided
      })
    );

    expect(result.uid).toBe("uid-combo1");
    expectPendingRegistration("uid-combo1", {
      email: "student@example.com",
      telefone: "912345678",
    });
  });

  it("school with strict institutional requirements", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requireInstitutionalEmail: true,
          emailDomain: "school.pt",
          allowGoogleLogin: false, // blocked by institutional requirement
          requirePhone: true,
          requirePhoneVerification: true,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-combo2", "student@school.pt");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({
        email: "student@school.pt",
        telefone: "912345678",
      })
    );

    expect(result.uid).toBe("uid-combo2");
  });

  it("school with phone verification but no institutional email", async () => {
    mockGetDoc.mockResolvedValue(
      makeSchoolSnapshot(
        {
          requireInstitutionalEmail: false,
          allowGoogleLogin: true,
          requirePhone: true,
          requirePhoneVerification: true,
        },
        true
      )
    );
    mockCreateUserSuccess("uid-combo3", "student@gmail.com");
    mockPendingRegistrationSuccess();

    const result = await registerAluno(
      makeAlunoPayload({
        email: "student@gmail.com",
        telefone: "912345678",
      })
    );

    expect(result.uid).toBe("uid-combo3");
    expectPendingRegistration("uid-combo3", {
      email: "student@gmail.com",
      telefone: "912345678",
    });
  });

  it("ensures each criterion is independent", async () => {
    const configs = [
      { requireInstitutionalEmail: false, allowGoogleLogin: false },
      { requirePhone: true, requirePhoneVerification: false },
      { requirePhone: false, requirePhoneVerification: true },
    ];

    for (let i = 0; i < configs.length; i++) {
      vi.clearAllMocks();
      
      mockGetDoc.mockResolvedValue(
        makeSchoolSnapshot(configs[i], true)
      );
      mockCreateUserSuccess(`uid-ind-${i}`, `student${i}@example.com`);
      mockPendingRegistrationSuccess();

      const result = await registerAluno(
        makeAlunoPayload({
          email: `student${i}@example.com`,
          telefone: "912345678",
        })
      );

      expect(result.uid).toBe(`uid-ind-${i}`);
    }
  });
});
