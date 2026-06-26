export type MetodoCalculo = "soma" | "media";

export type EscalaAvaliacao = {
  min: number;
  max: number;
};

export type ParametroAvaliacao = {
  nome: string;
};

export type AvaliacaoConfig = {
  parametros: ParametroAvaliacao[];
  escala: EscalaAvaliacao;
  metodoCalculo: MetodoCalculo;
  notaFinalEsperada: EscalaAvaliacao;
  permitirTutorVerNotaFinal: boolean;
};

export type SignatureData = {
  uid: string;
  nome: string;
  role: string;
  signedAt: string;
  signatureDataUrl: string;
};

export type NotasTutor = {
  parametros: Record<string, number>;
  assinaturaTutor?: SignatureData;
  assinaturaProfessor?: SignatureData;
  estado: "pendente" | "assinado";
  assinadoEm?: string;
  resetCount?: number;
};

export type NotaFinalProfessor = {
  notaFinal: number;
  assinaturaProfessor?: SignatureData;
  estado: "pendente" | "assinado";
  assinadoEm?: string;
};

export type DatasAvaliacao = {
  disponibilidadePreenchimento: string;
  publicacaoNotaFinal: string;
};

export type CursoDatasAvaliacao = {
  cursoId: string;
  schoolId: string;
  datas: DatasAvaliacao;
  autoArquivarNaPublicacao?: boolean;
  overridesPorEstagio?: Record<string, { disponibilidadePreenchimento: string }>;
};
