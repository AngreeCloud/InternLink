/**
 * Pure business logic for schedule change requests.
 * No Firebase dependencies — fully testable in isolation.
 */

import { listWorkDays, type DiasSemanaMap } from "@/lib/estagios/workdays";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleChangeRequestType =
  | "future_absence"
  | "past_absence_justification"
  | "early_termination";

export type ScheduleChangeRequestStatus =
  | "pending_professor"
  | "pending_tutor"
  | "approved"
  | "rejected"
  | "cancelled"
  | "acknowledged";

export type RequestComment = {
  authorId: string;
  authorRole: "aluno" | "professor" | "tutor" | "diretor";
  text: string;
  createdAt: unknown; // Firestore Timestamp or null when pending
};

export type ScheduleChangeRequest = {
  id: string;
  estagioId: string;
  studentId: string;
  professorId: string;
  tutorId: string;
  type: ScheduleChangeRequestType;
  /** ISO date — the targeted absence day (or the termination effective date) */
  targetDate: string;
  hoursAffected: number;
  reason: string;
  status: ScheduleChangeRequestStatus;
  professorDecision?: "approved" | "rejected";
  professorDecidedAt?: unknown;
  tutorDecision?: "approved" | "rejected";
  tutorDecidedAt?: unknown;
  comments: RequestComment[];
  createdAt: unknown;
  updatedAt: unknown;
};

// ---------------------------------------------------------------------------
// Early-termination eligibility
// ---------------------------------------------------------------------------

/**
 * Returns true when the remaining hours are strictly less than one full work day.
 * This is the condition under which a student may request early termination.
 */
export function canRequestEarlyTermination(
  horasRestantes: number,
  horasDia: number
): boolean {
  if (!Number.isFinite(horasRestantes) || !Number.isFinite(horasDia) || horasDia <= 0) {
    return false;
  }
  return horasRestantes < horasDia;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type Actor = "professor" | "tutor" | "diretor";
export type DecisionAction = "approve" | "reject";

type Transition = {
  from: ScheduleChangeRequestStatus;
  actors: Actor[];
  action: DecisionAction;
  to: ScheduleChangeRequestStatus;
};

const TRANSITIONS: Transition[] = [
  // Professor (or diretor acting as professor) approves → awaiting tutor
  {
    from: "pending_professor",
    actors: ["professor", "diretor"],
    action: "approve",
    to: "pending_tutor",
  },
  // Professor rejects → done
  {
    from: "pending_professor",
    actors: ["professor", "diretor"],
    action: "reject",
    to: "rejected",
  },
  // Tutor approves → approved
  {
    from: "pending_tutor",
    actors: ["tutor"],
    action: "approve",
    to: "approved",
  },
  // Tutor rejects → rejected
  {
    from: "pending_tutor",
    actors: ["tutor"],
    action: "reject",
    to: "rejected",
  },
];

export type TransitionResult =
  | { ok: true; nextStatus: ScheduleChangeRequestStatus }
  | { ok: false; reason: string };

/**
 * Validates and returns the next status after a decision.
 */
export function getNextStatus(
  currentStatus: ScheduleChangeRequestStatus,
  actor: Actor,
  action: DecisionAction
): TransitionResult {
  const match = TRANSITIONS.find(
    (t) =>
      t.from === currentStatus &&
      t.actors.includes(actor) &&
      t.action === action
  );

  if (!match) {
    return {
      ok: false,
      reason: `Transição inválida: ${actor} não pode ${action} um pedido com estado "${currentStatus}".`,
    };
  }

  return { ok: true, nextStatus: match.to };
}

// ---------------------------------------------------------------------------
// Overlap validation
// ---------------------------------------------------------------------------

/**
 * Returns true if the new request overlaps with any existing active request
 * (i.e., any request that is not rejected or cancelled) on the same targetDate.
 */
export function validateNoOverlap(
  existing: Pick<ScheduleChangeRequest, "targetDate" | "status">[],
  newTargetDate: string
): { ok: boolean; conflictingStatus?: ScheduleChangeRequestStatus } {
  const active: ScheduleChangeRequestStatus[] = [
    "pending_professor",
    "pending_tutor",
    "approved",
  ];

  const conflict = existing.find(
    (r) => r.targetDate === newTargetDate && active.includes(r.status)
  );

  if (conflict) {
    return { ok: false, conflictingStatus: conflict.status };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Workday extension (for absence approval side-effect)
// ---------------------------------------------------------------------------

/**
 * Given the current end date of the estagio, returns the next valid workday
 * to be used as the new estimated end date after an absence is approved.
 */
export function calcNewEndDate(
  currentEndDate: string,
  diasSemana: DiasSemanaMap
): string {
  if (!currentEndDate) return currentEndDate;

  // Try a generous window (60 calendar days beyond the current end)
  const [y, m, d] = currentEndDate.split("-").map(Number);
  if (!y || !m || !d) return currentEndDate;

  const windowStart = new Date(y, m - 1, d + 1);
  const windowEnd = new Date(y, m - 1, d + 61);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const isoStart = `${windowStart.getFullYear()}-${pad(windowStart.getMonth() + 1)}-${pad(windowStart.getDate())}`;
  const isoEnd = `${windowEnd.getFullYear()}-${pad(windowEnd.getMonth() + 1)}-${pad(windowEnd.getDate())}`;

  const nextWorkdays = listWorkDays(isoStart, isoEnd, diasSemana);

  if (nextWorkdays.length === 0) return currentEndDate;
  return nextWorkdays[0].iso;
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

export function labelForRequestType(type: ScheduleChangeRequestType): string {
  switch (type) {
    case "future_absence":
      return "Aviso de falta futura";
    case "past_absence_justification":
      return "Justificação de falta";
    case "early_termination":
      return "Término antecipado";
  }
}

/**
 * Returns true when the request type requires approval (future absence or early termination).
 * Past absence justifications are informational only — no approval needed.
 */
export function requiresApproval(type: ScheduleChangeRequestType): boolean {
  return type === "future_absence" || type === "early_termination";
}

export function labelForStatus(status: ScheduleChangeRequestStatus): string {
  switch (status) {
    case "pending_professor":
      return "Aguarda professor";
    case "pending_tutor":
      return "Aguarda tutor";
    case "approved":
      return "Aprovado";
    case "rejected":
      return "Rejeitado";
    case "cancelled":
      return "Cancelado";
    case "acknowledged":
      return "Tomado conhecimento";
  }
}

export function variantForStatus(
  status: ScheduleChangeRequestStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "approved":
    case "acknowledged":
      return "default";
    case "rejected":
    case "cancelled":
      return "destructive";
    case "pending_professor":
    case "pending_tutor":
      return "secondary";
    default:
      return "outline";
  }
}
