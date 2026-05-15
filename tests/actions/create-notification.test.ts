import { describe, expect, it } from "vitest";
import {
  buildNotification,
  shouldNotifyProfessorOnCreate,
  shouldNotifyTutorOnCreate,
  shouldNotifyTutorOnProfessorDecision,
  shouldNotifyProfessorOnTutorDecision,
  shouldNotifyStudent,
} from "@/lib/notifications/create-notification";

const REQ_ID = "req123";
const ESTAGIO_ID = "estagioA";
const TARGET_DATE = "2026-05-10";

describe("buildNotification", () => {
  it("builds request_created for future_absence to professor", () => {
    const n = buildNotification("profUid", REQ_ID, "future_absence", TARGET_DATE, ESTAGIO_ID, {
      kind: "request_created",
      studentName: "João",
    });
    expect(n.userId).toBe("profUid");
    expect(n.title).toContain("falta futura");
    expect(n.body).toContain("João");
    expect(n.body).toContain(TARGET_DATE);
    expect(n.readAt).toBeNull();
    expect(n.type).toBe("schedule_change_request");
    expect(n.requestType).toBe("future_absence");
    expect(n.estagioId).toBe(ESTAGIO_ID);
  });

  it("builds request_created for past_absence_justification to professor", () => {
    const n = buildNotification("profUid", REQ_ID, "past_absence_justification", TARGET_DATE, ESTAGIO_ID, {
      kind: "request_created",
      studentName: "Maria",
    });
    expect(n.title).toContain("justificação");
    expect(n.body).toContain("Maria");
    expect(n.body).toContain("justificação");
  });

  it("builds request_created for early_termination to professor", () => {
    const n = buildNotification("profUid", REQ_ID, "early_termination", TARGET_DATE, ESTAGIO_ID, {
      kind: "request_created",
      studentName: "Pedro",
    });
    expect(n.title).toContain("término");
    expect(n.body).toContain("Pedro");
  });

  it("builds professor_approved to tutor", () => {
    const n = buildNotification("tutorUid", REQ_ID, "future_absence", TARGET_DATE, ESTAGIO_ID, {
      kind: "professor_approved",
      actorName: "Prof. Silva",
    });
    expect(n.title).toContain("aprovado");
    expect(n.body).toContain("Prof. Silva");
    expect(n.body).toContain("Aguarda");
  });

  it("builds professor_rejected to tutor", () => {
    const n = buildNotification("tutorUid", REQ_ID, "future_absence", TARGET_DATE, ESTAGIO_ID, {
      kind: "professor_rejected",
      actorName: "Prof. Silva",
    });
    expect(n.title).toContain("recusado");
    expect(n.body).toContain("Prof. Silva");
    expect(n.body).not.toContain("Aguarda");
  });

  it("builds tutor_approved to professor", () => {
    const n = buildNotification("profUid", REQ_ID, "future_absence", TARGET_DATE, ESTAGIO_ID, {
      kind: "tutor_approved",
      actorName: "Tutor ABC",
    });
    expect(n.title).toContain("aprovou");
    expect(n.body).toContain("Tutor ABC");
    expect(n.body).toContain("concluído");
  });

  it("builds tutor_rejected to professor", () => {
    const n = buildNotification("profUid", REQ_ID, "future_absence", TARGET_DATE, ESTAGIO_ID, {
      kind: "tutor_rejected",
      actorName: "Tutor ABC",
    });
    expect(n.title).toContain("recusou");
    expect(n.body).toContain("Tutor ABC");
  });

  it("builds justification_result justificada to student", () => {
    const n = buildNotification("studentUid", REQ_ID, "past_absence_justification", TARGET_DATE, ESTAGIO_ID, {
      kind: "justification_result",
      result: "justificada",
    });
    expect(n.title).toContain("justificação");
    expect(n.body).toContain("justificada");
    expect(n.body).toContain(TARGET_DATE);
  });

  it("builds justification_result não justificada to student", () => {
    const n = buildNotification("studentUid", REQ_ID, "past_absence_justification", TARGET_DATE, ESTAGIO_ID, {
      kind: "justification_result",
      result: "não justificada",
    });
    expect(n.title).toContain("justificação");
    expect(n.body).toContain("não justificada");
  });
});

describe("shouldNotifyProfessorOnCreate", () => {
  it("returns true for future_absence", () => {
    expect(shouldNotifyProfessorOnCreate("future_absence")).toBe(true);
  });
  it("returns true for past_absence_justification", () => {
    expect(shouldNotifyProfessorOnCreate("past_absence_justification")).toBe(true);
  });
  it("returns true for early_termination", () => {
    expect(shouldNotifyProfessorOnCreate("early_termination")).toBe(true);
  });
});

describe("shouldNotifyTutorOnCreate", () => {
  it("returns true for past_absence_justification", () => {
    expect(shouldNotifyTutorOnCreate("past_absence_justification")).toBe(true);
  });
  it("returns false for future_absence", () => {
    expect(shouldNotifyTutorOnCreate("future_absence")).toBe(false);
  });
  it("returns false for early_termination", () => {
    expect(shouldNotifyTutorOnCreate("early_termination")).toBe(false);
  });
});

describe("shouldNotifyTutorOnProfessorDecision", () => {
  it("notifies tutor when nextStatus is pending_tutor", () => {
    expect(shouldNotifyTutorOnProfessorDecision("future_absence", "pending_tutor")).toBe(true);
  });
  it("does not notify tutor when nextStatus is approved (skip tutor step)", () => {
    expect(shouldNotifyTutorOnProfessorDecision("past_absence_justification", "approved")).toBe(false);
  });
  it("does not notify tutor when rejected", () => {
    expect(shouldNotifyTutorOnProfessorDecision("future_absence", "rejected")).toBe(false);
  });
});

describe("shouldNotifyProfessorOnTutorDecision", () => {
  it("notifies professor when tutor approves (nextStatus = approved)", () => {
    expect(shouldNotifyProfessorOnTutorDecision("future_absence", "approved")).toBe(true);
  });
  it("notifies professor when tutor rejects (nextStatus = rejected)", () => {
    expect(shouldNotifyProfessorOnTutorDecision("future_absence", "rejected")).toBe(true);
  });
  it("does not notify professor when status is unchanged", () => {
    expect(shouldNotifyProfessorOnTutorDecision("future_absence", "pending_tutor")).toBe(false);
  });
});

describe("shouldNotifyStudent", () => {
  it("notifies student when request is approved", () => {
    expect(shouldNotifyStudent("future_absence", "approved")).toBe(true);
  });
  it("notifies student when request is rejected", () => {
    expect(shouldNotifyStudent("future_absence", "rejected")).toBe(true);
  });
  it("does not notify when still pending", () => {
    expect(shouldNotifyStudent("future_absence", "pending_tutor")).toBe(false);
  });
});
