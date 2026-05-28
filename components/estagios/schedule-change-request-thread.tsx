"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatIsoPt } from "@/lib/estagios/workdays";
import {
  labelForRequestType,
  labelForStatus,
  variantForStatus,
  requiresApproval,
  skipsTutorStep,
  type ScheduleChangeRequest,
  type RequestComment,
} from "@/lib/estagios/schedule-change-requests";
import type { EstagioRole } from "@/lib/estagios/permissions";

type Props = {
  request: ScheduleChangeRequest;
  estagioId: string;
  currentUserId: string;
  currentUserRole: EstagioRole;
  onUpdated: () => void;
  initialOpen?: boolean;
};

function labelForRole(role: string): string {
  switch (role) {
    case "aluno":
      return "Aluno";
    case "professor":
      return "Professor";
    case "tutor":
      return "Tutor";
    case "diretor":
      return "Diretor de Curso";
    default:
      return role;
  }
}

function formatCreatedAt(raw: unknown): string {
  if (!raw) return "";
  // ISO string from comment (we store new Date().toISOString())
  if (typeof raw === "string") {
    try {
      return new Date(raw).toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return raw;
    }
  }
  // Firestore Timestamp shape { seconds, nanoseconds }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const ts = raw as { seconds: number };
    return new Date(ts.seconds * 1000).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
}

export function ScheduleChangeRequestThread({
  request,
  estagioId,
  currentUserId,
  currentUserRole,
  onUpdated,
  initialOpen,
}: Props) {
  const [isOpen, setIsOpen] = useState(Boolean(initialOpen));
  const autoOpenedRef = useRef(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const isInformOnly = !requiresApproval(request.type);
  const isJustificacao = request.type === "past_absence_justification";

  useEffect(() => {
    if (!initialOpen || autoOpenedRef.current) return;
    setIsOpen(true);
    autoOpenedRef.current = true;
  }, [initialOpen]);

  const isProfessorTurn =
    request.status === "pending_professor" &&
    (currentUserRole === "professor" || currentUserRole === "diretor");
  const isTutorTurn =
    !skipsTutorStep(request.type) &&
    request.status === "pending_tutor" &&
    currentUserRole === "tutor";

  const canDecide = isProfessorTurn || isTutorTurn;
  const isResolved =
    isInformOnly ||
    request.status === "approved" ||
    request.status === "rejected" ||
    request.status === "cancelled" ||
    request.status === "acknowledged";

  function decisionEndpoint(): string {
    if (isProfessorTurn) {
      return `/api/estagios/${estagioId}/schedule-change-requests/${request.id}/professor-decision`;
    }
    return `/api/estagios/${estagioId}/schedule-change-requests/${request.id}/tutor-decision`;
  }

  async function handleDecision(action: "approve" | "reject" | "cancel") {
    setDecisionError(null);
    setIsSubmitting(true);
    try {
      const endpoint = action === "cancel" 
        ? `/api/estagios/${estagioId}/schedule-change-requests/${request.id}/cancel`
        : decisionEndpoint();

      const res = await fetch(endpoint, {
        method: action === "cancel" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "cancel" ? undefined : JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setDecisionError(data.error ?? "Erro ao processar a decisão.");
        return;
      }
      onUpdated();
    } catch {
      setDecisionError("Erro de rede. Tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/estagios/${estagioId}/schedule-change-requests/${request.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: commentText.trim() }),
        }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao enviar comentário.");
        return;
      }
      setCommentText("");
      onUpdated();
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const comments = Array.isArray(request.comments) ? request.comments : [];

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {labelForRequestType(request.type)} — {formatIsoPt(request.targetDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
            </p>
          </div>
        </div>
        {isJustificacao && currentUserRole === "tutor" ? (
          <Badge variant="outline">Justificação</Badge>
        ) : (
          <Badge variant={variantForStatus(request.status)}>
            {labelForStatus(request.status, request.type)}
          </Badge>
        )}
      </button>

      {isOpen && (
        <CardContent className="space-y-4 border-t pt-4">
          {/* Request metadata */}
          <div className="rounded-md bg-muted/30 px-4 py-3 text-sm">
            <p>
              <span className="text-muted-foreground">Tipo:</span>{" "}
              <span className="font-medium">{labelForRequestType(request.type)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Data:</span>{" "}
              <span className="font-medium">{formatIsoPt(request.targetDate)}</span>
            </p>
            {request.absenceType === "partial" && request.hoursAffected > 0 && (
              <p>
                <span className="text-muted-foreground">Falta parcial:</span>{" "}
                <span className="font-medium">{request.hoursAffected}h</span>
              </p>
            )}
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">Motivo:</p>
            <p className="mt-1 text-sm">{request.reason}</p>
          </div>

          {/* Inform-only notice (legacy) */}
          {isInformOnly && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Justificação informativa — professor e tutor ficaram a saber. Não requer
              aprovação.
            </div>
          )}

          {/* Tutor read-only notice for justifications */}
          {isJustificacao && currentUserRole === "tutor" && (
            <div className="rounded-md border border-muted bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
              Como tutor, tens acesso de consulta a esta justificação. A decisão cabe ao
              professor orientador.
            </div>
          )}

          {/* Justification notice (hidden from tutor) */}
          {isJustificacao && currentUserRole !== "tutor" && !isInformOnly && !isResolved && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              O professor orientador deve decidir se a falta é justificada ou não. O tutor
              será notificado da decisão.
            </div>
          )}

          {/* Justification resolved notice (hidden from tutor) */}
          {isJustificacao && currentUserRole !== "tutor" && isResolved && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              O professor decidiu que esta falta é{" "}
              <strong>
                {request.status === "approved" ? "justificada" : "não justificada"}
              </strong>
              . O tutor foi notificado.
            </div>
          )}

          {/* Decision actions */}
          {canDecide && !isResolved && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                A tua decisão
              </p>
              {decisionError && (
                <p className="text-xs text-destructive">{decisionError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("approve")}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isJustificacao ? "Falta justificada" : "Aprovar"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("reject")}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isJustificacao ? "Falta não justificada" : "Rejeitar"}
                </Button>
              </div>
            </div>
          )}

          {/* Student cancel action */}
          {currentUserRole === "aluno" && request.studentId === currentUserId && (request.status === "pending_professor" || request.status === "pending_tutor") && (
            <div className="space-y-2 mt-4">
              {decisionError && <p className="text-xs text-destructive">{decisionError}</p>}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                disabled={isSubmitting}
                onClick={() => handleDecision("cancel")}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                )}
                Cancelar pedido
              </Button>
            </div>
          )}

          {/* Comments thread */}
          {comments.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Discussão
              </p>
              {comments.map((c: RequestComment, idx: number) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${c.authorId === currentUserId ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      c.authorId === currentUserId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="mb-1 text-[10px] font-semibold opacity-70">
                      {labelForRole(c.authorRole)}
                      {!!c.createdAt && (
                        <span className="ml-2 font-normal">
                          {formatCreatedAt(c.createdAt)}
                        </span>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap">{String(c.text ?? "")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          {!isResolved && (
            <div className="space-y-2">
              <label
                htmlFor={`comment-${request.id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
                Adicionar comentário
              </label>
              <Textarea
                id={`comment-${request.id}`}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escreve uma mensagem..."
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting || !commentText.trim()}
                  onClick={handleComment}
                >
                  {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function CardHeader2({ children }: { children: React.ReactNode }) {
  return <CardHeader>{children}</CardHeader>;
}
