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
    dataNascimento,
    localidade,
    telefone,
  } = parsed;

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
  const { nome, email, password, escolaId, escolaNome, dataNascimento, localidade, telefone } = parsed;

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
  const { nome, email, password, empresa, dataNascimento, localidade, telefone } = parsed;

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
