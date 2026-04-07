import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { z } from "zod";
import {
  alunoRegisterActionSchema,
  professorRegisterActionSchema,
  tutorRegisterActionSchema,
} from "@/lib/validators/register";

function createErrorWithCode(message: string, code: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function normalizeDomain(domain: string) {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

function emailMatchesDomain(email: string, domain: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return false;
  const atIndex = normalizedEmail.lastIndexOf("@");
  if (atIndex < 0) return false;
  return normalizedEmail.slice(atIndex + 1) === normalizedDomain;
}

async function ensureSchoolEmailDomainAllowed(db: unknown, escolaId: string, email: string) {
  const schoolSnapshot = await getDoc(doc(db as never, "schools", escolaId));

  if (!schoolSnapshot.exists()) {
    return;
  }

  const school = schoolSnapshot.data() as Partial<{ requireInstitutionalEmail: boolean; emailDomain: string }>;
  if (!school.requireInstitutionalEmail) {
    return;
  }

  if (!emailMatchesDomain(email, school.emailDomain ?? "")) {
    throw createErrorWithCode(
      "Esta escola exige email institucional. Use um email com o domínio correto.",
      "auth/invalid-school-email-domain"
    );
  }
}

async function rollbackAuthUser(user: User) {
  try {
    await deleteUser(user);
  } catch (error) {
    // Keep the original registration error and just log rollback failures.
    console.error("Falha ao remover utilizador Auth após erro de registo:", error);
  }
}

async function verifyRecaptchaToken(token: string, action: "register_aluno" | "register_professor" | "register_tutor") {
  const response = await fetch("/api/recaptcha/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, action }),
  });

  if (!response.ok) {
    throw createErrorWithCode("Falha ao validar CAPTCHA.", "auth/recaptcha-check-failed");
  }

  const payload = (await response.json()) as { success?: boolean };
  if (!payload.success) {
    throw createErrorWithCode("Token CAPTCHA inválido.", "auth/invalid-recaptcha-token");
  }
}

export async function registerAluno(data: z.input<typeof alunoRegisterActionSchema>) {
  const parsed = alunoRegisterActionSchema.parse(data);
  const {
    nome,
    email,
    password,
    escolaId,
    escolaNome,
    cursoId,
    cursoNome,
    recaptchaToken,
    dataNascimento,
    localidade,
    telefone,
  } = parsed;

  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    if (!recaptchaToken) {
      throw createErrorWithCode("Token CAPTCHA em falta.", "auth/missing-recaptcha-token");
    }
    await verifyRecaptchaToken(recaptchaToken, "register_aluno");
  }

  const auth = await getAuthRuntime();
  const db = await getDbRuntime();

  await ensureSchoolEmailDomainAllowed(db, escolaId, email);

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userId = user.uid;

  // Store registration data in pendingRegistrations collection
  // This will be used to create the user document after email verification
  const pendingRegistrationData = {
    role: "aluno",
    nome,
    email,
    escola: escolaNome,
    curso: cursoNome,
    schoolId: escolaId,
    courseId: cursoId,
    dataNascimento,
    localidade: localidade || "",
    telefone: telefone || "",
    encarregadoId: null,
    estado: "pendente",
    emailVerified: false,
    createdAt: serverTimestamp(),
  };

  try {
    // Store pending registration data
    await setDoc(doc(db, "pendingRegistrations", userId), pendingRegistrationData);
    
    // Send email verification
    await sendEmailVerification(user);
  } catch (error) {
    await rollbackAuthUser(user);
    throw error;
  }

  return { uid: userId, email: user.email, createdAt: user.metadata.creationTime };
}

export async function registerProfessor(data: z.input<typeof professorRegisterActionSchema>) {
  const parsed = professorRegisterActionSchema.parse(data);
  const { nome, email, password, escolaId, escolaNome, recaptchaToken, dataNascimento, localidade, telefone } = parsed;

  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    if (!recaptchaToken) {
      throw createErrorWithCode("Token CAPTCHA em falta.", "auth/missing-recaptcha-token");
    }
    await verifyRecaptchaToken(recaptchaToken, "register_professor");
  }

  const auth = await getAuthRuntime();
  const db = await getDbRuntime();

  await ensureSchoolEmailDomainAllowed(db, escolaId, email);

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userId = user.uid;

  // Store registration data in pendingRegistrations collection
  const pendingRegistrationData = {
    role: "professor",
    nome,
    email,
    escola: escolaNome,
    schoolId: escolaId,
    courseId: null,
    dataNascimento: dataNascimento || "",
    localidade: localidade || "",
    telefone: telefone || "",
    estado: "pendente",
    emailVerified: false,
    createdAt: serverTimestamp(),
  };

  try {
    // Store pending registration data
    await setDoc(doc(db, "pendingRegistrations", userId), pendingRegistrationData);
    
    // Send email verification
    await sendEmailVerification(user);
  } catch (error) {
    await rollbackAuthUser(user);
    throw error;
  }

  return { uid: userId, email: user.email, createdAt: user.metadata.creationTime };
}

export async function registerTutor(data: z.input<typeof tutorRegisterActionSchema>) {
  const parsed = tutorRegisterActionSchema.parse(data);
  const { nome, email, password, empresa, recaptchaToken, dataNascimento, localidade, telefone } = parsed;

  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    if (!recaptchaToken) {
      throw createErrorWithCode("Token CAPTCHA em falta.", "auth/missing-recaptcha-token");
    }
    await verifyRecaptchaToken(recaptchaToken, "register_tutor");
  }

  const auth = await getAuthRuntime();
  const db = await getDbRuntime();

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userId = user.uid;

  const tutorUserData = {
    role: "tutor",
    nome,
    email,
    empresa,
    dataNascimento: dataNascimento || "",
    localidade: localidade || "",
    telefone: telefone || "",
    estado: "ativo",
    emailVerified: user.emailVerified,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "users", userId), tutorUserData);

    if (!user.emailVerified) {
      await sendEmailVerification(user);
    }
  } catch (error) {
    await rollbackAuthUser(user);
    throw error;
  }

  return { uid: userId, email: user.email, createdAt: user.metadata.creationTime };
}
