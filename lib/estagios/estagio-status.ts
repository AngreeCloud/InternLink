export function checkShouldTransitionToConcluido(params: {
  totalHoras: number;
  totalRealizado: number;
  hasTerminoAprovado: boolean;
}): boolean {
  return params.totalRealizado >= params.totalHoras || params.hasTerminoAprovado;
}
