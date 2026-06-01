export type TooltipDayInfo = {
  hasRegistered: boolean;
  acumuladas: number;
  registadasDia: number;
};

export function calcTooltipDayInfo(
  tooltipDay: string,
  workDays: { iso: string }[],
  presencas: Record<string, { hoursWorked?: number }>,
  presencaSet: Set<string>,
  effectiveHoursForDay: (iso: string) => number,
): TooltipDayInfo {
  const hasRegistered = presencaSet.has(tooltipDay);

  const horasRegistadas =
    hasRegistered && typeof presencas[tooltipDay]?.hoursWorked === "number"
      ? presencas[tooltipDay].hoursWorked
      : 0;

  const acumuladas = workDays
    .filter((wd) => wd.iso <= tooltipDay)
    .reduce((sum, wd) => {
      const p = presencas[wd.iso];
      if (p && typeof p.hoursWorked === "number") {
        return sum + p.hoursWorked;
      }
      return sum + effectiveHoursForDay(wd.iso);
    }, 0);

  return { hasRegistered, acumuladas, registadasDia: horasRegistadas };
}
