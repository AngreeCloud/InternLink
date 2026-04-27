"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Search, Megaphone, Loader2, ExternalLink } from "lucide-react";
import { BroadcastDialog } from "@/components/estagios/documentos/broadcast-dialog";
import { UploadWizard, type UploadWizardDoc } from "@/components/estagios/documentos/upload-wizard";
import type { EstagioRole } from "@/lib/estagios/permissions";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";

type Documento = {
  id: string;
  estagioId: string;
  nome: string;
  descricao: string;
  categoria: string;
  estado: string;
  currentVersion: number;
  currentFileUrl: string;
  currentFilePath: string;
  fileMimeType: string;
  fileExtension: string;
  broadcastCourseId: string;
  isBroadcast: boolean;
  accessRoles: EstagioRole[];
  signatureRoles: EstagioRole[];
  signatureBoxes: SignatureBoxModel[];
  role: EstagioRole;
  estagioTitulo: string;
  alunoNome: string;
  empresa: string;
  courseNome: string;
  createdAt: number | null;
  updatedAt: number | null;
};

type Estagio = {
  id: string;
  titulo: string;
  alunoNome: string;
  empresa: string;
  courseNome: string;
  role: EstagioRole;
};

type DocsApiResponse = {
  ok?: boolean;
  uid?: string;
  schoolId?: string;
  items?: Array<Record<string, unknown>>;
  estagios?: Array<Record<string, unknown>>;
  error?: string;
};

type ScopeFilter = "all" | "broadcast" | "manual";

const DEFAULT_ACCESS_ROLES: EstagioRole[] = ["diretor", "professor", "tutor", "aluno"];

function toMillis(value: unknown): number | null {
  if (!value && value !== 0) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return null;
}

function normalizeDoc(raw: Record<string, unknown>): Documento {
  const broadcastCourseId =
    typeof raw.broadcastCourseId === "string" ? raw.broadcastCourseId : "";
  const fileExtensionRaw =
    typeof raw.fileExtension === "string" ? raw.fileExtension.toLowerCase() : "";

  return {
    id: String(raw.id ?? ""),
    estagioId: String(raw.estagioId ?? ""),
    nome: String(raw.nome ?? "Documento sem título"),
    descricao: typeof raw.descricao === "string" ? raw.descricao : "",
    categoria: typeof raw.categoria === "string" ? raw.categoria : "outros",
    estado: typeof raw.estado === "string" ? raw.estado : "pendente",
    currentVersion: typeof raw.currentVersion === "number" ? raw.currentVersion : 0,
    currentFileUrl: typeof raw.currentFileUrl === "string" ? raw.currentFileUrl : "",
    currentFilePath: typeof raw.currentFilePath === "string" ? raw.currentFilePath : "",
    fileMimeType: typeof raw.fileMimeType === "string" ? raw.fileMimeType : "",
    fileExtension: fileExtensionRaw,
    broadcastCourseId,
    isBroadcast: broadcastCourseId.length > 0,
    accessRoles: Array.isArray(raw.accessRoles) ? (raw.accessRoles as EstagioRole[]) : [],
    signatureRoles: Array.isArray(raw.signatureRoles) ? (raw.signatureRoles as EstagioRole[]) : [],
    signatureBoxes: Array.isArray(raw.signatureBoxes)
      ? (raw.signatureBoxes as SignatureBoxModel[])
      : [],
    role: (raw.role as EstagioRole) ?? "professor",
    estagioTitulo: typeof raw.estagioTitulo === "string" ? raw.estagioTitulo : "—",
    alunoNome: typeof raw.alunoNome === "string" ? raw.alunoNome : "—",
    empresa: typeof raw.empresa === "string" ? raw.empresa : "—",
    courseNome: typeof raw.courseNome === "string" ? raw.courseNome : "—",
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
  };
}

function normalizeEstagio(raw: Record<string, unknown>): Estagio {
  return {
    id: String(raw.id ?? ""),
    titulo: typeof raw.titulo === "string" ? raw.titulo : "—",
    alunoNome: typeof raw.alunoNome === "string" ? raw.alunoNome : "—",
    empresa: typeof raw.empresa === "string" ? raw.empresa : "—",
    courseNome: typeof raw.courseNome === "string" ? raw.courseNome : "—",
    role: (raw.role as EstagioRole) ?? "professor",
  };
}

function formatDate(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT");
}

export function DocumentManager() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [schoolId, setSchoolId] = useState("");
  const [userId, setUserId] = useState("");
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false);
  const [selectedEstagio, setSelectedEstagio] = useState("");
  const [uploadWizard, setUploadWizard] = useState<
    { estagioId: string; doc: UploadWizardDoc } | null
  >(null);
  const [preparingUpload, setPreparingUpload] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<
    { created: number; total: number; courses: number } | null
  >(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/professor/documentos", { cache: "no-store" });
      const data = (await res.json()) as DocsApiResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível carregar os documentos.");
        return;
      }

      setUserId(typeof data.uid === "string" ? data.uid : "");
      setSchoolId(typeof data.schoolId === "string" ? data.schoolId : "");

      const docs = Array.isArray(data.items)
        ? data.items.map((item) => normalizeDoc(item as Record<string, unknown>))
        : [];
      setDocumentos(docs);

      const estagiosRaw = Array.isArray(data.estagios) ? data.estagios : [];
      setEstagios(estagiosRaw.map((item) => normalizeEstagio(item as Record<string, unknown>)));
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      setError("Erro inesperado ao carregar documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documentos.filter((d) => {
      if (scope === "broadcast" && !d.isBroadcast) return false;
      if (scope === "manual" && d.isBroadcast) return false;
      if (!term) return true;

      const bag = [
        d.nome,
        d.descricao,
        d.categoria,
        d.estagioTitulo,
        d.alunoNome,
        d.empresa,
        d.courseNome,
      ]
        .join(" ")
        .toLowerCase();
      return bag.includes(term);
    });
  }, [documentos, scope, search]);

  const openNewVersionWizard = (documento: Documento) => {
    setUploadWizard({
      estagioId: documento.estagioId,
      doc: {
        id: documento.id,
        nome: documento.nome,
        descricao: documento.descricao,
        categoria: documento.categoria,
        signatureBoxes: documento.signatureBoxes,
        signatureRoles: documento.signatureRoles,
        accessRoles: documento.accessRoles.length ? documento.accessRoles : DEFAULT_ACCESS_ROLES,
        currentFileUrl: documento.currentFileUrl,
        currentFilePath: documento.currentFilePath,
        estado: documento.estado,
        fileMimeType: documento.fileMimeType,
        fileExtension: documento.fileExtension,
      },
    });
  };

  const prepareUpload = async () => {
    if (!selectedEstagio) {
      setError("Selecione um estágio para carregar o documento.");
      return;
    }

    setPreparingUpload(true);
    setError(null);
    try {
      const res = await fetch(`/api/estagios/${selectedEstagio}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Novo documento",
          descricao: "",
          categoria: "outros",
          accessRoles: DEFAULT_ACCESS_ROLES,
          signatureRoles: [],
          signatureBoxes: [],
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        setError(data.error || "Não foi possível preparar o upload.");
        return;
      }

      setUploadPickerOpen(false);
      setSelectedEstagio("");

      setUploadWizard({
        estagioId: selectedEstagio,
        doc: {
          id: data.id,
          nome: "Novo documento",
          descricao: "",
          categoria: "outros",
          signatureBoxes: [],
          signatureRoles: [],
          accessRoles: DEFAULT_ACCESS_ROLES,
        },
      });
    } catch (error) {
      console.error("Erro ao preparar upload:", error);
      setError("Erro inesperado ao preparar upload.");
    } finally {
      setPreparingUpload(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Documentos</h1>
          <p className="text-muted-foreground">
            Carregar documentos, difundir por turma e pesquisar por estágio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setBroadcastOpen(true)}
            disabled={!userId || !schoolId}
          >
            <Megaphone className="mr-2 h-4 w-4" />
            Difundir por turma
          </Button>
          <Button onClick={() => setUploadPickerOpen(true)} disabled={!estagios.length}>
            <Upload className="mr-2 h-4 w-4" />
            Carregar Documento
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por documento, aluno, empresa, curso ou estágio..."
            className="pl-9"
          />
        </div>
        <div className="md:w-56">
          <Select value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="broadcast">Apenas broadcast</SelectItem>
              <SelectItem value="manual">Sem broadcast</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {broadcastResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Documento difundido com sucesso em {broadcastResult.created} de {broadcastResult.total}{" "}
          estágio(s), em {broadcastResult.courses} turma(s) selecionada(s).
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {userId && schoolId ? (
        <BroadcastDialog
          professorUid={userId}
          schoolId={schoolId}
          open={broadcastOpen}
          onOpenChange={setBroadcastOpen}
          onSuccess={(r) => {
            setBroadcastResult({
              created: r.created,
              total: r.total,
              courses: r.courseIds.length,
            });
            void loadData();
          }}
        />
      ) : null}

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar documentos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum documento</h3>
              <p className="text-muted-foreground">
                Sem resultados para os filtros atuais.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((documento) => (
                <div
                  key={documento.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{documento.nome}</h4>
                      <Badge variant="outline" className="text-xs">
                        {(documento.fileExtension || "ficheiro").toUpperCase()}
                      </Badge>
                      {documento.isBroadcast ? <Badge className="text-xs">Broadcast</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">Estágio: {documento.estagioTitulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Aluno: {documento.alunoNome} • Empresa: {documento.empresa} • Curso: {documento.courseNome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Estado: {documento.estado} • Versão: {documento.currentVersion} • Atualizado em:{" "}
                      {formatDate(documento.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openNewVersionWizard(documento)}>
                      Nova versão
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/professor/estagios/${documento.estagioId}`}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Abrir estágio
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadPickerOpen} onOpenChange={setUploadPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolher estágio</DialogTitle>
            <DialogDescription>
              Selecione o estágio onde quer criar e carregar um novo documento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="upload-estagio">Estágio</Label>
            <Select value={selectedEstagio} onValueChange={setSelectedEstagio}>
              <SelectTrigger id="upload-estagio">
                <SelectValue placeholder="Selecione um estágio" />
              </SelectTrigger>
              <SelectContent>
                {estagios.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.alunoNome} • {e.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadPickerOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void prepareUpload()} disabled={!selectedEstagio || preparingUpload}>
              {preparingUpload ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />A preparar...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />Continuar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {uploadWizard ? (
        <UploadWizard
          estagioId={uploadWizard.estagioId}
          doc={uploadWizard.doc}
          open={Boolean(uploadWizard)}
          onOpenChange={(open) => {
            if (!open) setUploadWizard(null);
          }}
          onSuccess={() => {
            setUploadWizard(null);
            void loadData();
          }}
        />
      ) : null}
    </div>
  );
}
