"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatIsoPt } from "@/lib/estagios/workdays";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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

export type EstagioMetaLite = {
  id: string;
  titulo: string;
  alunoNome: string;
  empresa: string;
  courseNome: string;
  schoolId: string;
};

type Props = {
  requests: ScheduleChangeRequest[];
  estagiosById: Record<string, EstagioMetaLite | undefined>;
  currentUserId: string;
  currentUserRole: EstagioRole;
  basePath: "professor" | "tutor";
  emptyTitle: string;
  emptyDescription?: string;
};

function buildRequestHref(
  basePath: "professor" | "tutor",
  estagio: EstagioMetaLite | undefined,
  request: ScheduleChangeRequest
): string | null {
  if (!estagio) return null;
  if (basePath === "professor") {
    return `/professor/estagios/${estagio.id}?tab=calendario&requestId=${request.id}`;
  }
  if (!estagio.schoolId) return null;
  return `/tutor/estagios/${estagio.schoolId}/${estagio.id}?tab=calendario&requestId=${request.id}`;
}

function labelForRole(role: string): string {
  switch (role) {
    case "aluno": return "Aluno";
    case "professor": return "Professor";
    case "tutor": return "Tutor";
    case "diretor": return "Diretor de Curso";
    default: return role;
  }
}

function formatCreatedAt(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    try {
      return new Date(raw).toLocaleString("pt-PT", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return raw; }
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const ts = raw as { seconds: number };
    return new Date(ts.seconds * 1000).toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  return "";
}

function RequestCard({
  request,
  estagio,
  currentUserId,
  currentUserRole,
  href,
  currentUserIsProfessor,
  currentUserIsTutor,
  onUpdated,
}: {
  request: ScheduleChangeRequest;
  estagio: EstagioMetaLite | undefined;
  currentUserId: string;
  currentUserRole: EstagioRole;
  href: string | null;
  currentUserIsProfessor: boolean;
  currentUserIsTutor: boolean;
  onUpdated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const isJustificacao = request.type === "past_absence_justification";
  const isInformOnly = !requiresApproval(request.type);

  const isProfessorTurn =
    request.status === "pending_professor" &&
    currentUserIsProfessor;
  const isTutorTurn =
    !skipsTutorStep(request.type) &&
    request.status === "pending_tutor" &&
    currentUserIsTutor;

  const canDecide = isProfessorTurn || isTutorTurn;
  const isResolved =
    isInformOnly ||
    request.status === "approved" ||
    request.status === "rejected" ||
    request.status === "cancelled" ||
    request.status === "acknowledged";

  function decisionEndpoint(): string {
    if (isProfessorTurn) {
      return `/api/estagios/${request.estagioId}/schedule-change-requests/${request.id}/professor-decision`;
    }
    return `/api/estagios/${request.estagioId}/schedule-change-requests/${request.id}/tutor-decision`;
  }

  async function handleDecision(action: "approve" | "reject") {
    setDecisionError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(decisionEndpoint(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
        `/api/estagios/${request.estagioId}/schedule-change-requests/${request.id}/comments`,
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
    <Card className="overflow-hidden">
      {/* Always-visible header */}
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {estagio?.alunoNome || "Aluno"} · {estagio?.titulo || "Estágio"}
          </p>
          <p className="text-xs text-muted-foreground">
            {labelForRequestType(request.type)} · {formatIsoPt(request.targetDate)}
          </p>
          {estagio?.empresa || estagio?.courseNome ? (
            <p className="text-xs text-muted-foreground">
              {estagio?.empresa ? `Empresa: ${estagio.empresa}` : ""}
              {estagio?.empresa && estagio?.courseNome ? " · " : ""}
              {estagio?.courseNome ? `Curso: ${estagio.courseNome}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={variantForStatus(request.status)}>
            {labelForStatus(request.status, request.type)}
          </Badge>
          {href ? (
            <Button asChild size="sm" variant="outline">
              <Link href={href}>Abrir estágio</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Expand/collapse trigger */}
      <button
        type="button"
        className="flex w-full items-center gap-2 border-t px-4 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {isOpen ? "Fechar ações" : canDecide ? "Tomar decisão" : "Ver detalhes e comentários"}
      </button>

      {/* Expandable action area */}
      {isOpen && (
        <CardContent className="space-y-4 border-t pt-4">
          <div className="rounded-md bg-muted/30 px-4 py-3 text-sm">
            <p>
              <span className="text-muted-foreground">Tipo:</span>{" "}
              <span className="font-medium">{labelForRequestType(request.type)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Data:</span>{" "}
              <span className="font-medium">{formatIsoPt(request.targetDate)}</span>
            </p>
            {request.hoursAffected > 0 && (
              <p>
                <span className="text-muted-foreground">Horas afetadas:</span>{" "}
                <span className="font-medium">{request.hoursAffected}h</span>
              </p>
            )}
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">Motivo:</p>
            <p className="mt-1 text-sm">{request.reason}</p>
          </div>

          {isInformOnly && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Justificação informativa — professor e tutor ficaram a saber. Não requer aprovação.
            </div>
          )}

          {isJustificacao && currentUserIsTutor && (
            <div className="rounded-md border border-muted bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
              Como tutor, tens acesso de consulta a esta justificação. A decisão cabe ao professor orientador.
            </div>
          )}

          {isJustificacao && !currentUserIsTutor && !isInformOnly && !isResolved && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              O professor orientador deve decidir se a falta é justificada ou não. O tutor será notificado da decisão.
            </div>
          )}

          {isJustificacao && !currentUserIsTutor && isResolved && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              O professor decidiu que esta falta é{" "}
              <strong>
                {request.status === "approved" ? "justificada" : "não justificada"}
              </strong>
              . O tutor foi notificado.
            </div>
          )}

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

export function ScheduleChangeRequestsList({
  requests,
  estagiosById,
  currentUserId,
  currentUserRole,
  basePath,
  emptyTitle,
  emptyDescription,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const currentUserIsProfessor = currentUserRole === "professor" || currentUserRole === "diretor";
  const currentUserIsTutor = currentUserRole === "tutor";

  if (requests.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="space-y-2 py-8 text-center">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="text-xs text-muted-foreground">{emptyDescription}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" key={refreshKey}>
      {requests.map((request) => {
        const estagio = estagiosById[request.estagioId];
        const href = buildRequestHref(basePath, estagio, request);

        return (
          <RequestCard
            key={request.id}
            request={request}
            estagio={estagio}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            href={href}
            currentUserIsProfessor={currentUserIsProfessor}
            currentUserIsTutor={currentUserIsTutor}
            onUpdated={() => setRefreshKey((k) => k + 1)}
          />
        );
      })}
    </div>
  );
}
