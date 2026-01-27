"use client";

import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";

export async function registerAluno(data: {
  nome: string;
  email: string;
  password: string;
  escola: string;
  curso: string;
  dataNascimento: string;
  localidade?: string;
  telefone?: string;
}) {
  const { nome, email, password, escola, curso, dataNascimento, localidade, telefone } = data;

  if (!nome || !email || !password || !escola || !curso || !dataNascimento) {
    throw new Error("Campos obrigatórios não preenchidos.");
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
    escola,
    curso,
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

export async function registerProfessor(data: {
  nome: string;
  email: string;
  password: string;
  escola: string;
  dataNascimento?: string;
  localidade?: string;
  telefone?: string;
}) {
  const { nome, email, password, escola, dataNascimento, localidade, telefone } = data;

  if (!nome || !email || !password || !escola) {
    throw new Error("Campos obrigatórios não preenchidos.");
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
    escola,
    dataNascimento: dataNascimento || "",
    localidade: localidade || "",
    telefone: telefone || "",
    estado: "pendente",
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", userId), userDoc);
  return { uid: userId, email: user.email, createdAt: user.metadata.creationTime };
}

export async function registerTutor(data: {
  nome: string;
  email: string;
  password: string;
  empresa: string;
  dataNascimento?: string;
  localidade?: string;
  telefone?: string;
}) {
  const { nome, email, password, empresa, dataNascimento, localidade, telefone } = data;

  if (!nome || !email || !password || !empresa) {
    throw new Error("Campos obrigatórios não preenchidos.");
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
