export type PresencasValidationResult = {
  podeValidar: boolean;
  motivo?: string;
  totalRealizado: number;
  totalPrevisto: number;
  diasRestantes: number;
};

export function checkPresencasCanValidate(
  totalRealizado: number,
  totalPrevisto: number,
  horasPorDia: number
): PresencasValidationResult {
  const restante = Math.max(0, totalPrevisto - totalRealizado);
  const diasRestantes = horasPorDia > 0 ? Math.ceil(restante / horasPorDia) : 0;
  const horasCompletas = totalRealizado >= totalPrevisto;
  const faltamMenosDe2Dias = restante > 0 && restante < horasPorDia * 2;

  if (!horasCompletas && !faltamMenosDe2Dias) {
    return {
      podeValidar: false,
      motivo: `Ainda faltam ${formatDiasRestantes(diasRestantes)} (${restante}h).`,
      totalRealizado,
      totalPrevisto,
      diasRestantes,
    };
  }

  return { podeValidar: true, totalRealizado, totalPrevisto, diasRestantes };
}

function formatDiasRestantes(dias: number): string {
  if (dias === 1) return "1 dia de trabalho";
  return `${dias} dias de trabalho`;
}
