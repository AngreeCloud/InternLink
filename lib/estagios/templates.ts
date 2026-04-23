import type { EstagioRole } from "@/lib/estagios/permissions";

/**
 * Templates pré-definidos para documentos de estágio FCT.
 * Quando um estágio é criado, a API seed-a esta lista em
 * `estagios/{id}/documentos`. O PDF fica por anexar (upload posterior pelo
 * Diretor de Curso), mas os metadados, `accessRoles` e `signatureRoles` ficam
 * prontos a usar.
 */

export type TemplateDocumentoEstagio = {
  code: string;
  nome: string;
  descricao: string;
  categoria: "protocolo" | "avaliacao" | "presencas" | "relatorio" | "outros";
  accessRoles: EstagioRole[];
  signatureRoles: EstagioRole[];
  ordem: number;
};

export const ESTAGIO_TEMPLATES: TemplateDocumentoEstagio[] = [
  {
    code: "ea_im_55",
    nome: "EA-IM-55 — Protocolo de Estágio",
    descricao:
      "Protocolo base do estágio FCT. Assinado pelo Diretor de Curso, entidade de acolhimento (tutor) e aluno.",
    categoria: "protocolo",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["diretor", "tutor", "aluno"],
    ordem: 1,
  },
  {
    code: "ea_im_52",
    nome: "EA-IM-52 — Plano de Trabalho Individual",
    descricao:
      "Plano de trabalho individual do estágio. Assinado pelo Diretor, orientador, tutor e aluno.",
    categoria: "protocolo",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["diretor", "professor", "tutor", "aluno"],
    ordem: 2,
  },
  {
    code: "ea_im_53",
    nome: "EA-IM-53 — Registo de Assiduidade",
    descricao: "Folha semanal de assiduidade. Preenchida e assinada pelo tutor e aluno.",
    categoria: "presencas",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["tutor", "aluno"],
    ordem: 3,
  },
  {
    code: "ea_im_54",
    nome: "EA-IM-54 — Ficha de Avaliação Intercalar",
    descricao:
      "Avaliação intercalar do desempenho do aluno. Preenchida pelo tutor, validada pelo orientador.",
    categoria: "avaliacao",
    accessRoles: ["diretor", "professor", "tutor"],
    signatureRoles: ["professor", "tutor"],
    ordem: 4,
  },
  {
    code: "ea_im_56",
    nome: "EA-IM-56 — Ficha de Avaliação Final",
    descricao: "Avaliação final do desempenho do aluno na entidade de acolhimento.",
    categoria: "avaliacao",
    accessRoles: ["diretor", "professor", "tutor"],
    signatureRoles: ["diretor", "professor", "tutor"],
    ordem: 5,
  },
  {
    code: "ea_im_57",
    nome: "EA-IM-57 — Autoavaliação do Aluno",
    descricao: "Autoavaliação preenchida pelo aluno no final do estágio.",
    categoria: "avaliacao",
    accessRoles: ["diretor", "professor", "aluno"],
    signatureRoles: ["aluno"],
    ordem: 6,
  },
  {
    code: "ea_im_58",
    nome: "EA-IM-58 — Relatório de Estágio do Aluno",
    descricao: "Relatório final escrito pelo aluno descrevendo as atividades desenvolvidas.",
    categoria: "relatorio",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["professor", "aluno"],
    ordem: 7,
  },
  {
    code: "ea_im_59",
    nome: "EA-IM-59 — Sumários Semanais",
    descricao: "Sumários semanais das atividades realizadas pelo aluno.",
    categoria: "relatorio",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["tutor", "aluno"],
    ordem: 8,
  },
  {
    code: "ea_im_60",
    nome: "EA-IM-60 — Declaração de Confidencialidade",
    descricao: "Compromisso de confidencialidade assinado pelo aluno junto da entidade de acolhimento.",
    categoria: "protocolo",
    accessRoles: ["diretor", "tutor", "aluno"],
    signatureRoles: ["tutor", "aluno"],
    ordem: 9,
  },
  {
    code: "ea_im_61",
    nome: "EA-IM-61 — Adenda ao Protocolo",
    descricao: "Adenda ao protocolo base, emitida em caso de alteração de condições.",
    categoria: "protocolo",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["diretor", "tutor", "aluno"],
    ordem: 10,
  },
  {
    code: "ea_im_62",
    nome: "EA-IM-62 — Termo de Responsabilidade",
    descricao: "Termo assinado pelo encarregado de educação (se aplicável) ou pelo próprio aluno.",
    categoria: "protocolo",
    accessRoles: ["diretor", "aluno"],
    signatureRoles: ["aluno"],
    ordem: 11,
  },
  {
    code: "ea_im_63",
    nome: "EA-IM-63 — Certificado de Estágio",
    descricao: "Certificado final emitido pela escola após conclusão do estágio com aproveitamento.",
    categoria: "outros",
    accessRoles: ["diretor", "professor", "tutor", "aluno"],
    signatureRoles: ["diretor"],
    ordem: 12,
  },
];

export function findTemplateByCode(code: string): TemplateDocumentoEstagio | undefined {
  return ESTAGIO_TEMPLATES.find((t) => t.code === code);
}
