"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Search,
  MoreHorizontal,
  Pin,
  PinOff,
  Eye,
  PenLine,
  History,
  Upload,
  Loader2,
  Plus,
} from "lucide-react";
import { UploadWizard, type UploadWizardDoc } from "./upload-wizard";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { SignDialog } from "./sign-dialog";
import { VersionHistoryDialog } from "./version-history-dialog";
import { cn } from "@/lib/utils";
import {
  canSignDoc,
  type EstagioRole,
  type DocumentoEstagio,
} from "@/lib/estagios/permissions";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";

type DocState = "pendente" | "aguarda_assinatura" | "parcial" | "assinado";

export type EstagioDocument = {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  templateCode?: string;
  ordem?: number;
  pinned?: boolean;
  estado: DocState;
  prazoAssinatura?: string | null;
  accessRoles: EstagioRole[];
  accessUserIds: string[];
  signatureRoles: EstagioRole[];
  signatureUserIds: string[];
  signatureBoxes: SignatureBoxModel[];
  signedBy?: string[];
  signedByRoles?: EstagioRole[];
  currentVersion?: number;
  currentFileUrl?: string;
  currentFilePath?: string;
  createdAt?: number;
  updatedAt?: number;
};

type Props = {
  estagioId: string;
  currentUserId: string;
  currentUserRole: EstagioRole;
  canManage: boolean;
  participants: Record<string, { name: string; role: EstagioRole; email?: string }>;
};

const STATUS_LABEL: Record<DocState, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  aguarda_assinatura: { label: "A aguardar assinaturas", className: "bg-amber-100 text-amber-900" },
  parcial: { label: "Parcialmente assinado", className: "bg-blue-100 text-blue-900" },
  assinado: { label: "Assinado", className: "bg-emerald-100 text-emerald-900" },
};

const emptyWizardDoc = (id: string, nome: string, descricao: string): UploadWizardDoc => ({
  id,
  nome,
  descricao,
  categoria: "",
  signatureBoxes: [],
  signatureRoles: [],
  accessRoles: [],
});

export function DocumentList({
  estagioId,
  currentUserId,
  currentUserRole,
  canManage,
  participants,
}: Props) {
  const [docs, setDocs] = useState<EstagioDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "signed">("all");

  const [uploadDoc, setUploadDoc] = useState<UploadWizardDoc | null>(null);
  const [previewDoc, setPreviewDoc] = useState<EstagioDocument | null>(null);
  const [signDoc, setSignDoc] = useState<EstagioDocument | null>(null);
  const [historyDoc, setHistoryDoc] = useState<EstagioDocument | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      const q = query(
        collection(db, "estagios", estagioId, "documentos"),
        orderBy("ordem", "asc"),
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: EstagioDocument[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const createdAt = typeof data.createdAt === "object" && data.createdAt
              ? (data.createdAt as { toMillis?: () => number }).toMillis?.()
              : undefined;
            const updatedAt = typeof data.updatedAt === "object" && data.updatedAt
              ? (data.updatedAt as { toMillis?: () => number }).toMillis?.()
              : undefined;
            return {
              id: d.id,
              nome: (data.nome as string) || "Documento sem título",
              descricao: (data.descricao as string) || "",
              categoria: (data.categoria as string) || "",
              templateCode: (data.templateCode as string | undefined) ?? undefined,
              ordem: typeof data.ordem === "number" ? (data.ordem as number) : undefined,
              pinned: Boolean(data.pinned),
              estado: (data.estado as DocState) || "pendente",
              prazoAssinatura: (data.prazoAssinatura as string | null) ?? null,
              accessRoles: Array.isArray(data.accessRoles) ? (data.accessRoles as EstagioRole[]) : [],
              accessUserIds: Array.isArray(data.accessUserIds) ? (data.accessUserIds as string[]) : [],
              signatureRoles: Array.isArray(data.signatureRoles) ? (data.signatureRoles as EstagioRole[]) : [],
              signatureUserIds: Array.isArray(data.signatureUserIds) ? (data.signatureUserIds as string[]) : [],
              signatureBoxes: Array.isArray(data.signatureBoxes) ? (data.signatureBoxes as SignatureBoxModel[]) : [],
              signedBy: Array.isArray(data.signedBy) ? (data.signedBy as string[]) : [],
              signedByRoles: Array.isArray(data.signedByRoles) ? (data.signedByRoles as EstagioRole[]) : [],
              currentVersion: typeof data.currentVersion === "number" ? (data.currentVersion as number) : 0,
              currentFileUrl: (data.currentFileUrl as string | undefined) ?? "",
              currentFilePath: (data.currentFilePath as string | undefined) ?? "",
              createdAt,
              updatedAt,
            };
          });
          setDocs(list);
          setLoading(false);
        },
        (err) => {
          console.error("[v0] documentos snapshot error", err);
          setLoading(false);
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagioId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = docs;
    if (tab === "pending") list = list.filter((d) => d.estado !== "assinado");
    if (tab === "signed") list = list.filter((d) => d.estado === "assinado");
    if (s) list = list.filter((d) => d.nome.toLowerCase().includes(s));
    return [...list].sort((a, b) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if ((a.ordem ?? 999) !== (b.ordem ?? 999)) return (a.ordem ?? 999) - (b.ordem ?? 999);
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  }, [docs, search, tab]);

  const togglePin = async (d: EstagioDocument) => {
    if (!canManage) return;
    try {
      await fetch(`/api/estagios/${estagioId}/documentos/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !d.pinned }),
      });
    } catch (err) {
      console.error("[v0] toggle pin failed", err);
    }
  };

  const createBlankDoc = async () => {
    if (!canManage) return;
    try {
      const res = await fetch(`/api/estagios/${estagioId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Novo documento",
          descricao: "",
          categoria: "outros",
          accessRoles: ["diretor", "professor", "tutor", "aluno"],
          signatureRoles: [],
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        console.error("[v0] create doc failed", data.error);
        return;
      }
      // Abrir wizard para o documento recém-criado.
      setUploadDoc({
        id: data.id,
        nome: "Novo documento",
        descricao: "",
        categoria: "outros",
        signatureBoxes: [],
        signatureRoles: [],
        accessRoles: ["diretor", "professor", "tutor", "aluno"],
      });
    } catch (err) {
      console.error("[v0] create doc error", err);
    }
  };

  const signerRequirementMet = (d: EstagioDocument): boolean => {
    const canSign = canSignDoc(currentUserId, currentUserRole, d as DocumentoEstagio);
    if (!canSign) return false;
    const already = (d.signedBy ?? []).includes(currentUserId);
    return !already;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar documento..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="pending">Por assinar</TabsTrigger>
              <TabsTrigger value="signed">Assinados</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && (
            <Button size="sm" onClick={createBlankDoc}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo documento
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border bg-card py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar documentos...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ainda não há documentos para este estágio.
          </p>
          {canManage && (
            <Button size="sm" onClick={createBlankDoc}>
              <Plus className="mr-1.5 h-4 w-4" />
              Carregar documento
            </Button>
          )}
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Progresso</th>
                <th className="px-4 py-3 font-medium">Atualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => {
                const mustSign = signerRequirementMet(d) && !!d.currentFileUrl;
                const signedCount = d.signedBy?.length ?? 0;
                const totalSigners = d.signatureUserIds.length || d.signatureRoles.length || 0;
                const hasFile = !!d.currentFileUrl;
                return (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {d.pinned ? (
                          <Pin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <button
                            className="truncate text-left font-medium hover:underline"
                            onClick={() => (hasFile ? setPreviewDoc(d) : null)}
                            disabled={!hasFile}
                          >
                            {d.nome}
                          </button>
                          {d.descricao && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">{d.descricao}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("font-normal", STATUS_LABEL[d.estado].className)}>
                        {STATUS_LABEL[d.estado].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hasFile
                        ? totalSigners > 0
                          ? `${signedCount}/${totalSigners} assinaturas`
                          : "—"
                        : "Sem PDF"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("pt-PT") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setUploadDoc({
                                id: d.id,
                                nome: d.nome,
                                descricao: d.descricao,
                                categoria: d.categoria,
                                templateCode: d.templateCode,
                                signatureBoxes: d.signatureBoxes,
                                signatureRoles: d.signatureRoles,
                                accessRoles: d.accessRoles,
                                currentFileUrl: d.currentFileUrl,
                                currentFilePath: d.currentFilePath,
                                estado: d.estado,
                              })
                            }
                          >
                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                            {hasFile ? "Nova versão" : "Carregar"}
                          </Button>
                        )}
                        {mustSign && (
                          <Button size="sm" onClick={() => setSignDoc(d)}>
                            <PenLine className="mr-1.5 h-3.5 w-3.5" />
                            Assinar
                          </Button>
                        )}
                        {hasFile && (
                          <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(d)}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Pré-visualizar</span>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Mais ações</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setHistoryDoc(d)}>
                              <History className="mr-2 h-4 w-4" />
                              Histórico de versões
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => togglePin(d)}>
                                  {d.pinned ? (
                                    <>
                                      <PinOff className="mr-2 h-4 w-4" />
                                      Desafixar
                                    </>
                                  ) : (
                                    <>
                                      <Pin className="mr-2 h-4 w-4" />
                                      Fixar no topo
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {uploadDoc && (
        <UploadWizard
          estagioId={estagioId}
          doc={uploadDoc}
          open={!!uploadDoc}
          onOpenChange={(o) => !o && setUploadDoc(null)}
          onSuccess={() => setUploadDoc(null)}
        />
      )}
      {previewDoc && (
        <DocumentPreviewDialog
          estagioId={estagioId}
          doc={previewDoc}
          open={!!previewDoc}
          onOpenChange={(o) => !o && setPreviewDoc(null)}
          participants={participants}
          currentUserId={currentUserId}
        />
      )}
      {signDoc && (
        <SignDialog
          estagioId={estagioId}
          docId={signDoc.id}
          docNome={signDoc.nome}
          open={!!signDoc}
          onOpenChange={(o) => !o && setSignDoc(null)}
          onSigned={() => setSignDoc(null)}
        />
      )}
      {historyDoc && (
        <VersionHistoryDialog
          estagioId={estagioId}
          documentId={historyDoc.id}
          documentTitle={historyDoc.nome}
          open={!!historyDoc}
          onOpenChange={(o) => !o && setHistoryDoc(null)}
        />
      )}
    </div>
  );
}

// Helper exportado caso seja útil noutros contextos.
export function buildEmptyWizardDoc(id: string, nome: string, descricao: string) {
  return emptyWizardDoc(id, nome, descricao);
}
