import type { Timestamp } from "firebase-admin/firestore";

export interface EmpresaFoto {
  id: string;
  url: string;
  legenda?: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
}

export interface Empresa {
  id: string;
  schoolId: string;

  nome: string;
  nomeNormalizado: string;
  nif?: string;
  setor?: string;
  website?: string;
  descricao?: string;

  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  concelho?: string;
  distrito?: string;
  pais?: string;

  emailGeral?: string;
  telefone?: string;

  logoUrl?: string;
  fotos?: EmpresaFoto[];

  tutorIds: string[];

  ativa: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
  archivedAt?: Timestamp;
  archivedBy?: string;
}

export interface EmpresaSnapshot {
  nome: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  nif?: string;
  emailGeral?: string;
  telefone?: string;
}

export function buildEmpresaSnapshot(empresa: Empresa): EmpresaSnapshot {
  return {
    nome: empresa.nome,
    morada: empresa.morada,
    codigoPostal: empresa.codigoPostal,
    localidade: empresa.localidade,
    nif: empresa.nif,
    emailGeral: empresa.emailGeral,
    telefone: empresa.telefone,
  };
}
