"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getAuthRuntime,
  getDbRuntime,
  getStorageRuntime,
} from "@/lib/firebase-runtime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Pin,
  Upload,
} from "lucide-react";
import { PdfViewer } from "@/components/estagios/pdf/pdf-viewer";
import { DocxPreview } from "@/components/estagios/documentos/docx-preview";

const MIME_PDF = "application/pdf";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type FileKind = "pdf" | "docx";

type EligibilityState = {
  hoursTotal: number;
  reportMinHours: number;
  reportWaitDays: number;
  dataInicio: string | null;
  availableAt: string | null;
};

type ReportSnapshot = {
  id: string;
  nome: string;
  descricao: string;
  currentFileUrl: string;
  currentFilePath: string;
  fileMimeType: string;
  fileExtension: string;
  currentVersion: number;
  updatedAt: string | null;
  submittedAt: string | null;
  pageCount?: number | null;
};

type ManagerState = {
  loading: boolean;
  loadingError: string | null;
  authReady: boolean;
  uid: string | null;
  estagioId: string | null;
  eligibility: EligibilityState | null;
  report: ReportSnapshot | null;
};

const DEFAULT_TITLE = "Relatório final de estágio";

function detectKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  if (file.type === MIME_PDF || name.endsWith(".pdf")) return "pdf";
  if (file.type === MIME_DOCX || name.endsWith(".docx")) return "docx";
  return null;
}

function formatHours(value: number) {
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1).replace(".", ",")}h`;
}

function formatDateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT");
}

export function StudentReportsManager() {
  const [state, setState] = useState<ManagerState>({
    loading: true,
    loadingError: null,
    authReady: false,
    uid: null,
    estagioId: null,
    eligibility: null,
    report: null,
  });

  const [titulo, setTitulo] = useState(DEFAULT_TITLE);
  const [resumo, setResumo] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileKind, setFileKind] = useState<FileKind | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup blob URL when file changes/unmounts.
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const refreshEligibility = async (estagioId: string) => {
    try {
      const res = await fetch(`/api/estagios/${estagioId}/relatorio-final`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingError: data.error || "Não foi possível carregar o estado do relatório.",
        }));
        return;
      }
      const data = (await res.json()) as {
        hoursTotal: number;
        reportMinHours: number;
        reportWaitDays: number;
        dataInicio: string | null;
        availableAt: string | null;
        report: ReportSnapshot | null;
      };
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingError: null,
        eligibility: {
          hoursTotal: data.hoursTotal,
          reportMinHours: data.reportMinHours,
          reportWaitDays: data.reportWaitDays,
          dataInicio: data.dataInicio,
          availableAt: data.availableAt,
        },
        report: data.report,
      }));

      if (data.report) {
        setTitulo(data.report.nome || DEFAULT_TITLE);
        setResumo(data.report.descricao || "");
      }
    } catch (err) {
      console.error("[v0] eligibility fetch failed", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingError: "Erro de rede ao carregar o estado do relatório.",
      }));
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!active) return;
        if (!user) {
          setState({
            loading: false,
            loadingError: "Sessão inexistente.",
            authReady: true,
            uid: null,
            estagioId: null,
            eligibility: null,
            report: null,
          });
          return;
        }

        try {
          const db = await getDbRuntime();
          const snap = await getDocs(
            query(collection(db, "estagios"), where("alunoId", "==", user.uid), limit(1)),
          );
          const estagioDoc = snap.docs[0] ?? null;
          if (!estagioDoc) {
            setState({
              loading: false,
              loadingError: "Sem estágio ativo.",
              authReady: true,
              uid: user.uid,
              estagioId: null,
              eligibility: null,
              report: null,
            });
            return;
          }

          setState((prev) => ({
            ...prev,
            authReady: true,
            uid: user.uid,
            estagioId: estagioDoc.id,
          }));
          await refreshEligibility(estagioDoc.id);
        } catch (err) {
          console.error("[v0] estagio lookup failed", err);
          setState({
            loading: false,
            loadingError: "Erro a localizar o estágio do aluno.",
            authReady: true,
            uid: user.uid,
            estagioId: null,
            eligibility: null,
            report: null,
          });
        }
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const eligibility = state.eligibility;
  const hoursPassed = eligibility ? eligibility.hoursTotal >= eligibility.reportMinHours : false;
  const waitDate = eligibility?.availableAt ? new Date(eligibility.availableAt) : null;
  const waitPeriodPassed = !waitDate || waitDate.getTime() <= Date.now();
  const canSubmit = !!eligibility && hoursPassed && waitPeriodPassed && !!state.estagioId;

  const blockingReasons = useMemo(() => {
    const list: string[] = [];
    if (!eligibility) return list;
    if (!hoursPassed) {
      const remaining = Math.max(0, eligibility.reportMinHours - eligibility.hoursTotal);
      list.push(
        `Faltam ${formatHours(remaining)} de estágio. Mínimo exigido: ${formatHours(
          eligibility.reportMinHours,
        )}.`,
      );
    }
    if (!waitPeriodPassed && waitDate) {
      list.push(`Envio disponível a partir de ${waitDate.toLocaleDateString("pt-PT")}.`);
    }
    return list;
  }, [eligibility, hoursPassed, waitPeriodPassed, waitDate]);

  const hoursPercent = eligibility
    ? Math.min(
        100,
        Math.round((eligibility.hoursTotal / Math.max(1, eligibility.reportMinHours)) * 100),
      )
    : 0;

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const selected = event.target.files?.[0];
    if (!selected) return;

    const kind = detectKind(selected);
    if (!kind) {
      setError("Apenas ficheiros PDF ou DOCX são aceites.");
      event.target.value = "";
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError("O ficheiro deve ter no máximo 20 MB.");
      event.target.value = "";
      return;
    }

    const buffer = new Uint8Array(await selected.arrayBuffer());
    setFile(selected);
    setFileBytes(buffer);
    setFileKind(kind);

    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    if (kind === "pdf") {
      const url = URL.createObjectURL(new Blob([buffer], { type: MIME_PDF }));
      setPdfBlobUrl(url);
    } else {
      setPdfBlobUrl(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileBytes(null);
    setFileKind(null);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!state.estagioId || !state.uid) return;
    if (!file || !fileBytes || !fileKind) {
      setError("Selecione um ficheiro PDF ou DOCX.");
      return;
    }
    if (!titulo.trim()) {
      setError("Indique um título para o relatório.");
      return;
    }
    if (!canSubmit) {
      setError("Ainda não estão reunidas as condições para submeter o relatório.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const storage = await getStorageRuntime();
      const extension = fileKind;
      const mimeType = fileKind === "pdf" ? MIME_PDF : MIME_DOCX;
      const storagePath = `estagios/${state.estagioId}/relatorios/v${Date.now()}.${extension}`;
      const sRef = ref(storage, storagePath);
      await uploadBytes(sRef, fileBytes, { contentType: mimeType });
      const downloadUrl = await getDownloadURL(sRef);

      const res = await fetch(`/api/estagios/${state.estagioId}/relatorio-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: downloadUrl,
          filePath: storagePath,
          fileName: file.name,
          fileMimeType: mimeType,
          fileExtension: extension,
          titulo: titulo.trim(),
          resumo: resumo.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível registar o relatório.");
        return;
      }

      setSuccess("Relatório submetido. Foi fixado nos documentos do estágio.");
      clearFile();
      await refreshEligibility(state.estagioId);
    } catch (err) {
      console.error("[v0] submit relatorio failed", err);
      setError(err instanceof Error ? err.message : "Erro inesperado ao submeter o relatório.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading) {
    return (
      <div className="flex h-72 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar relatório...
      </div>
    );
  }

  if (state.loadingError && !state.eligibility) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatório de Estágio</h1>
          <p className="text-muted-foreground">
            Submeta o seu relatório final assim que reunir as condições do curso.
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {state.loadingError}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatório de Estágio</h1>
        <p className="text-muted-foreground">
          Submeta o seu relatório final assim que reunir as condições do curso. O ficheiro é fixado
          automaticamente nos documentos do estágio para o orientador e o tutor verem.
        </p>
      </div>

      {eligibility && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Elegibilidade
            </CardTitle>
            <CardDescription>
              Mínimo: {formatHours(eligibility.reportMinHours)} • Período de espera:{" "}
              {eligibility.reportWaitDays} dia(s)
              {eligibility.dataInicio
                ? ` desde ${new Date(eligibility.dataInicio + "T00:00:00").toLocaleDateString("pt-PT")}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Horas registadas</span>
                <span className="font-medium text-foreground">
                  {formatHours(eligibility.hoursTotal)} / {formatHours(eligibility.reportMinHours)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    hoursPassed
                      ? "h-full bg-emerald-500 transition-all"
                      : "h-full bg-primary transition-all"
                  }
                  style={{ width: `${hoursPercent}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  canSubmit
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-amber-100 text-amber-900"
                }
              >
                {canSubmit ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Envio disponível
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Envio bloqueado
                  </span>
                )}
              </Badge>
              {blockingReasons.length > 0 && (
                <ul className="text-xs text-muted-foreground">
                  {blockingReasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {state.report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pin className="h-4 w-4 text-primary" />
              Relatório atual (fixado nos documentos)
            </CardTitle>
            <CardDescription>
              Versão {state.report.currentVersion} • Submetido em{" "}
              {formatDateLabel(state.report.submittedAt || state.report.updatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">{state.report.nome}</p>
              {state.report.descricao && (
                <p className="text-xs text-muted-foreground">{state.report.descricao}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Formato: {(state.report.fileExtension || "—").toUpperCase()}
              </p>
              {typeof state.report.pageCount === "number" ? (
                <p className="mt-1 text-xs text-muted-foreground">Páginas: {state.report.pageCount}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {state.report.currentFileUrl && (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a href={state.report.currentFileUrl} target="_blank" rel="noreferrer">
                      Visualizar
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={state.report.currentFileUrl} download>
                      <Download className="mr-2 h-4 w-4" /> Descarregar
                    </a>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{state.report ? "Substituir relatório" : "Submeter relatório"}</CardTitle>
          <CardDescription>
            Carregue um ficheiro PDF ou DOCX (máx. 20 MB). Pode pré-visualizar antes de submeter.
            {state.report ? " A nova versão substitui a anterior, mantendo o histórico." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="relatorio-titulo">Título</Label>
              <Input
                id="relatorio-titulo"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder={DEFAULT_TITLE}
                disabled={!canSubmit || submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relatorio-ficheiro">Ficheiro (PDF ou DOCX)</Label>
              <Input
                ref={fileInputRef}
                id="relatorio-ficheiro"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelected}
                disabled={!canSubmit || submitting}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Selecionado: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatorio-resumo">Resumo (opcional)</Label>
            <Textarea
              id="relatorio-resumo"
              value={resumo}
              onChange={(event) => setResumo(event.target.value)}
              placeholder="Atividades, resultados e aprendizagens mais relevantes."
              className="min-h-[100px]"
              maxLength={2000}
              disabled={!canSubmit || submitting}
            />
            <p className="text-xs text-muted-foreground">{resumo.length}/2000</p>
          </div>

          {file && fileKind ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Pré-visualização
                </Label>
                <Button type="button" variant="ghost" size="sm" onClick={clearFile}>
                  Remover ficheiro
                </Button>
              </div>
              <div className="max-h-[600px] overflow-auto rounded-md border bg-muted/30 p-3">
                {fileKind === "pdf" && pdfBlobUrl ? (
                  <PdfViewer fileBlobUrl={pdfBlobUrl} scale={1.1} />
                ) : (
                  <DocxPreview fileBytes={fileBytes} />
                )}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting || !file}
              className="min-w-[180px]"
            >
              {submitting ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar...
                </span>
              ) : (
                <span className="flex items-center">
                  <Upload className="mr-2 h-4 w-4" />
                  {state.report ? "Submeter nova versão" : "Submeter relatório"}
                </span>
              )}
            </Button>
            {!canSubmit && eligibility && (
              <span className="text-xs text-muted-foreground">
                Submissão fica disponível assim que cumprir os mínimos do curso.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
