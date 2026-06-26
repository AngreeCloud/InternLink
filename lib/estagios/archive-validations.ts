export type ArchiveCheckResult = {
  canArchive: boolean;
  reasons: string[];
};

export type ArchiveCheckInput = {
  estado: string;
  dataFimEstimada?: string | null;
  reportSubmitted: boolean;
  reportAllSigned: boolean;
  allSumariosPreenchidos: boolean;
  allSumariosAssinados: boolean;
  avaliacaoTutorAssinada: boolean;
  avaliacaoProfessorAssinada: boolean;
};

export function checkCanArchive(input: ArchiveCheckInput): ArchiveCheckResult {
  const reasons: string[] = [];

  if (input.estado === "arquivado") {
    reasons.push("Estágio já arquivado");
  }

  if (input.estado === "eliminado") {
    reasons.push("Estágio eliminado não pode ser arquivado");
  }

  if (!input.dataFimEstimada) {
    reasons.push("Estágio sem data prevista de término");
  } else {
    const dataFim = new Date(input.dataFimEstimada);
    if (dataFim >= new Date()) {
      reasons.push("Estágio ainda não passou da data prevista de término");
    }
  }

  if (!input.reportSubmitted) {
    reasons.push("Relatório final ainda não foi submetido");
  } else if (!input.reportAllSigned) {
    reasons.push("Relatório final ainda não foi assinado por todas as partes");
  }

  if (!input.allSumariosPreenchidos) {
    reasons.push("Nem todos os sumários foram preenchidos");
  }

  if (!input.allSumariosAssinados) {
    reasons.push("Nem todos os sumários foram assinados pelo tutor");
  }

  if (!input.avaliacaoTutorAssinada) {
    reasons.push("Avaliação do tutor não foi preenchida e assinada");
  }

  if (!input.avaliacaoProfessorAssinada) {
    reasons.push("Avaliação do professor não foi preenchida e assinada");
  }

  return {
    canArchive: reasons.length === 0,
    reasons,
  };
}

export function isPastEndDate(dataFimEstimada?: string | null): boolean {
  if (!dataFimEstimada) return false;
  return new Date(dataFimEstimada) < new Date();
}
