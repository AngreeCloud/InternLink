export type TooltipDayInfo = {
  hasRegistered: boolean;
  acumuladas: number;
  registadasDia: number;
  previstasDia: number;
};

type RequestInfo = {
  status: string;
  absenceType?: string;
  hoursAffected?: number;
};

const ACTIVE_STATUSES = ["pending_professor", "pending_tutor", "approved", "acknowledged", "expired"];

function dayEffectiveHours(
  iso: string,
  requestsByDate: Map<string, RequestInfo>,
  horasDiarias: number,
): number {
  const req = requestsByDate.get(iso);
  if (!req) return horasDiarias;
  if (!ACTIVE_STATUSES.includes(req.status)) return horasDiarias;
  if (req.absenceType === "total") return 0;
  if (req.absenceType === "partial" && typeof req.hoursAffected === "number") {
    return Math.max(0, horasDiarias - req.hoursAffected);
  }
  // Fallback for requests missing absenceType: infer from hoursAffected
  if (typeof req.hoursAffected === "number" && req.hoursAffected > 0) {
    return Math.max(0, horasDiarias - req.hoursAffected);
  }
  return 0;
}

export function calcTooltipDayInfo(
  tooltipDay: string,
  workDays: { iso: string }[],
  presencas: Record<string, { hoursWorked?: number }>,
  presencaSet: Set<string>,
  requestsByDate: Map<string, RequestInfo>,
  horasDiarias: number,
): TooltipDayInfo {
  const hasRegistered = presencaSet.has(tooltipDay);

  const horasRegistadas =
    hasRegistered && typeof presencas[tooltipDay]?.hoursWorked === "number"
      ? presencas[tooltipDay].hoursWorked
      : 0;

  const previstasDia = dayEffectiveHours(tooltipDay, requestsByDate, horasDiarias);

  const acumuladas = workDays
    .filter((wd) => wd.iso <= tooltipDay)
    .reduce((sum, wd) => {
      const p = presencas[wd.iso];
      if (p && typeof p.hoursWorked === "number") {
        return sum + p.hoursWorked;
      }
      return sum + dayEffectiveHours(wd.iso, requestsByDate, horasDiarias);
    }, 0);

  return { hasRegistered, acumuladas, registadasDia: horasRegistadas, previstasDia };
}
