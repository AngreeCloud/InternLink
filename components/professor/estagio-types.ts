import type { DiasSemana } from "@/lib/estagios/date-calc";

export type EstagioListItem = {
  id: string;
  titulo: string;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  tutorId: string;
  tutorNome?: string;
  tutorEmail?: string;
  empresa: string;
  estado: string;
  courseId: string;
  courseNome: string;
  dataInicio?: string;
  dataFimEstimada?: string;
  totalHoras?: number;
  horasDiarias?: number;
  diasSemana?: Partial<DiasSemana>;
  createdAt: string;
  createdAtMs: number;
};

export type StudentLite = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
};

export type TutorLite = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
  empresa: string;
};
