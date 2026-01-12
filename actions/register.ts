import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;

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

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;

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

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;

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
}
