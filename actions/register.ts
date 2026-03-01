"use client";

import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await sendEmailVerification(user);
  const userId = user.uid;

  const userDoc = {
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
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", userId), userDoc);
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

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await sendEmailVerification(user);
  const userId = user.uid;

  const userDoc = {
    role: "professor",
    nome,
    email,
    escola: escolaNome,
    schoolId: escolaId,
    dataNascimento: dataNascimento || "",
    localidade: localidade || "",
    telefone: telefone || "",
    estado: "pendente",
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", userId), userDoc);
  await setDoc(
    doc(db, "schools", escolaId, "pendingTeachers", userId),
    {
      name: nome,
      email,
      role: "teacher",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
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
  await sendEmailVerification(user);
  const userId = user.uid;

  const userDoc = {
    role: "tutor",
    nome,
    email,
    empresa,
    dataNascimento: dataNascimento || "",
    localidade: localidade || "",
    telefone: telefone || "",
    estado: "inativo",
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", userId), userDoc);
  return { uid: userId, email: user.email, createdAt: user.metadata.creationTime };
}
