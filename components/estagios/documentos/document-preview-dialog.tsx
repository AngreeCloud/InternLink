"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Clock } from "lucide-react";
import { PdfViewer } from "../pdf/pdf-viewer";
import {
  SignatureBoxesOverlay,
  type SignatureBoxModel,
} from "../pdf/signature-boxes-overlay";
import type { EstagioDocument } from "./document-list";
import type { EstagioRole } from "@/lib/estagios/permissions";

const ROLE_LABEL: Record<EstagioRole, string> = {
  diretor: "Diretor de Curso",
  professor: "Professor Orientador",
  tutor: "Tutor de Estágio",
  aluno: "Aluno",
};

type Props = {
  estagioId: string;
  doc: EstagioDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: Record<string, { name: string; role: EstagioRole; email?: string }>;
  currentUserId: string;
};

export function DocumentPreviewDialog({
  doc,
  open,
  onOpenChange,
  participants,
  currentUserId,
}: Props) {
  const signedByUsers = doc.signedBy ?? [];
  const totalSigners = doc.signatureUserIds.length || doc.signatureRoles.length;
  const signedCount = signedByUsers.length;
  const boxes: SignatureBoxModel[] = doc.signatureBoxes ?? [];

  // Listagem de signatários: combina userIds explicitos + os participantes cuja role é exigida.
  const signersList: Array<{ uid?: string; label: string; role?: EstagioRole; signed: boolean; mine: boolean }> = [];
  const seen = new Set<string>();

  for (const uid of doc.signatureUserIds) {
    const p = participants[uid];
    signersList.push({
      uid,
      label: p?.name ?? uid,
      role: p?.role,
      signed: signedByUsers.includes(uid),
      mine: uid === currentUserId,
    });
    seen.add(uid);
  }
  for (const role of doc.signatureRoles) {
    // Adicionar participantes com esta role, se ainda não listados por userId.
    const members = Object.entries(participants).filter(([, p]) => p.role === role);
    for (const [uid, p] of members) {
      if (seen.has(uid)) continue;
      signersList.push({
        uid,
        label: p.name,
        role,
        signed: signedByUsers.includes(uid),
        mine: uid === currentUserId,
      });
      seen.add(uid);
    }
    // Se não existir nenhum participante com essa role, listar só a role.
    if (!members.length) {
      signersList.push({
        label: ROLE_LABEL[role],
        role,
        signed: (doc.signedByRoles ?? []).includes(role),
        mine: false,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{doc.nome}</DialogTitle>
          <DialogDescription>
            {totalSigners > 0
              ? `${signedCount} de ${totalSigners} assinaturas recolhidas`
              : "Documento sem assinaturas configuradas"}
          </DialogDescription>
        </DialogHeader>

        {doc.currentFileUrl ? (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[1fr_280px]">
            <div className="min-h-0 overflow-auto rounded-lg border bg-muted/20 p-3">
              <PdfViewer
                fileUrl={doc.currentFileUrl}
                scale={1.1}
                renderPageOverlay={(info) => (
                  <SignatureBoxesOverlay
                    boxes={boxes}
                    pageNumber={info.pageNumber}
                    pageWidth={info.width}
                    pageHeight={info.height}
                    signedBoxIds={boxes
                      .filter((b) =>
                        b.role
                          ? (doc.signedByRoles ?? []).includes(b.role)
                          : b.userId
                            ? signedByUsers.includes(b.userId)
                            : false,
                      )
                      .map((b) => b.id)}
                  />
                )}
              />
            </div>

            <div className="space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Assinatários</h4>
                <ul className="space-y-2 text-sm">
                  {signersList.map((s, idx) => (
                    <li
                      key={`${s.uid ?? s.role}-${idx}`}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.label}</p>
                        {s.role && (
                          <p className="text-xs text-muted-foreground">{ROLE_LABEL[s.role]}</p>
                        )}
                      </div>
                      {s.signed ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-900">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Assinado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          {s.mine ? "Por si" : "Pendente"}
                        </Badge>
                      )}
                    </li>
                  ))}
                  {signersList.length === 0 && (
                    <li className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      Sem assinatários configurados.
                    </li>
                  )}
                </ul>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <a
                  href={doc.currentFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`${doc.nome}.pdf`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar PDF
                </a>
              </Button>

              <p className="text-xs text-muted-foreground">
                Versão {doc.currentVersion ?? 0}
                {doc.updatedAt
                  ? ` • ${new Date(doc.updatedAt).toLocaleString("pt-PT")}`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Documento indisponível.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
