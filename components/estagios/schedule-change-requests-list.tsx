"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatIsoPt } from "@/lib/estagios/workdays";
import {
  labelForRequestType,
  labelForStatus,
  variantForStatus,
  type ScheduleChangeRequest,
} from "@/lib/estagios/schedule-change-requests";
import type { EstagioRole } from "@/lib/estagios/permissions";
import { ScheduleChangeRequestThread } from "./schedule-change-request-thread";

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

export function ScheduleChangeRequestsList({
  requests,
  estagiosById,
  currentUserId,
  currentUserRole,
  basePath,
  emptyTitle,
  emptyDescription,
}: Props) {
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
    <div className="space-y-4">
      {requests.map((request) => {
        const estagio = estagiosById[request.estagioId];
        const href = buildRequestHref(basePath, estagio, request);

        return (
          <div key={request.id} className="space-y-2">
            <Card>
              <CardContent className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                <div className="flex items-center gap-2">
                  <Badge variant={variantForStatus(request.status)}>
                    {labelForStatus(request.status, request.type)}
                  </Badge>
                  {href ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={href}>Abrir estágio</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <ScheduleChangeRequestThread
              request={request}
              estagioId={request.estagioId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onUpdated={() => {}}
            />
          </div>
        );
      })}
    </div>
  );
}
