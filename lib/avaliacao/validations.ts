import type { AvaliacaoConfig, EscalaAvaliacao, MetodoCalculo, NotaFinalProfessor, NotasTutor } from "./types";

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export function validateEscala(escala: EscalaAvaliacao): ValidationResult {
  if (typeof escala.min !== "number" || typeof escala.max !== "number") {
    return { valid: false, error: "Escala deve ter valores numéricos para mínimo e máximo." };
  }
  if (escala.min >= escala.max) {
    return { valid: false, error: "O valor mínimo da escala deve ser inferior ao máximo." };
  }
  return { valid: true };
}

export function validateConfig(config: AvaliacaoConfig): ValidationResult {
  if (!config.parametros || config.parametros.length === 0) {
    return { valid: false, error: "É necessário definir pelo menos um parâmetro de avaliação." };
  }

  const escalaValidation = validateEscala(config.escala);
  if (!escalaValidation.valid) {
    return escalaValidation;
  }

  const notaFinalValidation = validateEscala(config.notaFinalEsperada);
  if (!notaFinalValidation.valid) {
    return { valid: false, error: `Nota final esperada: ${notaFinalValidation.error}` };
  }

  if (config.metodoCalculo !== "soma" && config.metodoCalculo !== "media") {
    return { valid: false, error: "Método de cálculo deve ser 'soma' ou 'media'." };
  }

  const coerencia = validateCoerenciaMatematica(
    config.parametros.length,
    config.escala,
    config.metodoCalculo,
    config.notaFinalEsperada
  );
  if (!coerencia.valid) {
    return coerencia;
  }

  return { valid: true };
}

export function validateCoerenciaMatematica(
  numParametros: number,
  escala: EscalaAvaliacao,
  metodo: MetodoCalculo,
  notaFinalEsperada: EscalaAvaliacao
): ValidationResult {
  if (metodo === "soma") {
    const maximoPossivel = numParametros * escala.max;
    const minimoPossivel = numParametros * escala.min;

    if (maximoPossivel !== notaFinalEsperada.max) {
      return {
        valid: false,
        error: `${numParametros} parâmetros × escala máxima ${escala.max} = ${maximoPossivel}. A nota final esperada tem máximo ${notaFinalEsperada.max}. Estes valores devem ser iguais.`,
      };
    }

    if (minimoPossivel !== notaFinalEsperada.min) {
      return {
        valid: false,
        error: `${numParametros} parâmetros × escala mínima ${escala.min} = ${minimoPossivel}. A nota final esperada tem mínimo ${notaFinalEsperada.min}. Estes valores devem ser iguais.`,
      };
    }
  }

  if (metodo === "media") {
    if (escala.min !== notaFinalEsperada.min || escala.max !== notaFinalEsperada.max) {
      return {
        valid: false,
        error: `No método média, a escala dos parâmetros (${escala.min}-${escala.max}) deve ser igual à escala da nota final esperada (${notaFinalEsperada.min}-${notaFinalEsperada.max}).`,
      };
    }
  }

  return { valid: true };
}

export function validateNotasTutor(
  notas: Record<string, number>,
  config: AvaliacaoConfig
): ValidationResult {
  const { escala, parametros } = config;

  for (const param of parametros) {
    const valor = notas[param.nome];
    if (typeof valor !== "number" || !Number.isInteger(valor)) {
      return {
        valid: false,
        error: `O parâmetro "${param.nome}" deve ter um valor inteiro.`,
      };
    }
    if (valor < escala.min || valor > escala.max) {
      return {
        valid: false,
        error: `O parâmetro "${param.nome}" tem valor ${valor}. Deve estar entre ${escala.min} e ${escala.max}.`,
      };
    }
  }

  return { valid: true };
}

export function validateNotaFinal(
  notaFinal: number,
  config: AvaliacaoConfig
): ValidationResult {
  const { notaFinalEsperada } = config;

  if (typeof notaFinal !== "number" || !Number.isInteger(notaFinal)) {
    return { valid: false, error: "A nota final deve ser um número inteiro." };
  }

  if (notaFinal < notaFinalEsperada.min || notaFinal > notaFinalEsperada.max) {
    return {
      valid: false,
      error: `A nota final ${notaFinal} está fora da escala esperada (${notaFinalEsperada.min}-${notaFinalEsperada.max}).`,
    };
  }

  return { valid: true };
}

export function calculateNotaFinal(
  notas: Record<string, number>,
  config: AvaliacaoConfig
): number {
  const valores = config.parametros.map((p) => notas[p.nome] ?? 0);

  if (config.metodoCalculo === "soma") {
    return valores.reduce((acc, v) => acc + v, 0);
  }

  const soma = valores.reduce((acc, v) => acc + v, 0);
  return Math.round(soma / valores.length);
}

export function canTutorSignAvaliacao(
  tutorData: NotasTutor | null
): { canSign: boolean; reason?: string } {
  if (tutorData?.estado === "assinado") {
    return { canSign: false, reason: "A avaliação já foi assinada." };
  }
  return { canSign: true };
}

export function canProfessorAssignNotaFinal(
  tutorData: NotasTutor | null,
  professorData: NotaFinalProfessor | null
): { canAssign: boolean; reason?: string } {
  if (!tutorData || tutorData.estado !== "assinado") {
    return {
      canAssign: false,
      reason: "O tutor ainda não assinou a avaliação.",
    };
  }
  if (professorData?.estado === "assinado") {
    return {
      canAssign: false,
      reason: "A nota final já foi atribuída e assinada.",
    };
  }
  return { canAssign: true };
}

export function isAvaliacaoAvailableForTutor(
  datas: { disponibilidadePreenchimento?: string } | null | undefined,
  now?: Date
): { available: boolean; message?: string } {
  const current = now ?? new Date();
  if (!datas?.disponibilidadePreenchimento) {
    return {
      available: true,
    };
  }
  const disponibilidade = new Date(datas.disponibilidadePreenchimento);
  if (current < disponibilidade) {
    return {
      available: false,
      message: `O preenchimento estará disponível a partir de ${disponibilidade.toLocaleDateString("pt-PT")}.`,
    };
  }
  return { available: true };
}

export function isNotaFinalAvailableForAluno(
  datas: { publicacaoNotaFinal?: string } | null | undefined,
  professorData: NotaFinalProfessor | null,
  now?: Date
): { available: boolean; message?: string } {
  const current = now ?? new Date();

  if (!professorData || professorData.estado !== "assinado") {
    return {
      available: false,
      message:
        "A nota final ainda não foi publicada. Será disponibilizada após a avaliação ser concluída.",
    };
  }

  if (!datas?.publicacaoNotaFinal) {
    return { available: true };
  }

  const publicacao = new Date(datas.publicacaoNotaFinal);
  if (current < publicacao) {
    return {
      available: false,
      message: `A nota final estará disponível a partir de ${publicacao.toLocaleDateString("pt-PT")}.`,
    };
  }

  return { available: true };
}

export function canTutorSeeNotaFinal(
  config: AvaliacaoConfig | null,
  professorData: NotaFinalProfessor | null
): { canSee: boolean; reason?: string } {
  if (!config?.permitirTutorVerNotaFinal) {
    return {
      canSee: false,
      reason:
        "A visibilidade da nota final para o tutor está desativada nas configurações da escola.",
    };
  }
  if (!professorData || professorData.estado !== "assinado") {
    return {
      canSee: false,
      reason: "O professor ainda não atribuiu a nota final.",
    };
  }
  return { canSee: true };
}
