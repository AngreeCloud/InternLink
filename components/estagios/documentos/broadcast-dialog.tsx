"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDbRuntime, getStorageRuntime } from "@/lib/firebase-runtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Megaphone, Trash2, Upload } from "lucide-react";
import { PdfViewer, type PdfPageInfo, type PdfViewerHandle } from "@/components/estagios/pdf/pdf-viewer";
import { SignatureBoxEditor } from "@/components/estagios/pdf/signature-box-editor";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";
import type { EstagioRole } from "@/lib/estagios/permissions";

const ROLE_LABEL: Record<EstagioRole, string> = {
  diretor: "Diretor",
  professor: "Orientador",
  tutor: "Tutor",
  aluno: "Aluno",
};

const COLOR_BY_ROLE: Record<EstagioRole, string> = {
  diretor: "#0ea5e9",
  professor: "#16a34a",
  tutor: "#ea580c",
  aluno: "#7c3aed",
};

const MIME_BY_EXTENSION: Record<"pdf" | "docx" | "xlsx", string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function resolveExtension(fileName: string): "pdf" | "docx" | "xlsx" | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
  if (!match?.[1]) return null;
  const ext = match[1];
  if (ext === "pdf" || ext === "docx" || ext === "xlsx") return ext;
  return null;
}

function resolveFileMeta(file: File): { mimeType: string; extension: "pdf" | "docx" | "xlsx"; isPdf: boolean } | null {
  const extension = resolveExtension(file.name);

  if (file.type === MIME_BY_EXTENSION.pdf || extension === "pdf") {
    return { mimeType: MIME_BY_EXTENSION.pdf, extension: "pdf", isPdf: true };
  }
  if (file.type === MIME_BY_EXTENSION.docx || extension === "docx") {
    return { mimeType: MIME_BY_EXTENSION.docx, extension: "docx", isPdf: false };
  }
  if (file.type === MIME_BY_EXTENSION.xlsx || extension === "xlsx") {
    return { mimeType: MIME_BY_EXTENSION.xlsx, extension: "xlsx", isPdf: false };
  }
  return null;
}

type CourseOption = {
  id: string;
  nome: string;
  estagiosCount: number;
};

export type BroadcastDialogProps = {
  professorUid: string;
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { courseIds: string[]; created: number; total: number }) => void;
};

export function BroadcastDialog({
  professorUid,
  schoolId,
  open,
  onOpenChange,
  onSuccess,
}: BroadcastDialogProps) {
  const [step, setStep] = useState<"meta" | "position">("meta");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileMimeType, setFileMimeType] = useState("");
  const [fileExtension, setFileExtension] = useState("");

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [accessRoles, setAccessRoles] = useState<EstagioRole[]>([
    "diretor",
    "professor",
    "tutor",
    "aluno",
  ]);
  const [enableSignatureFlow, setEnableSignatureFlow] = useState(false);
  const [signatureRoles, setSignatureRoles] = useState<EstagioRole[]>([]);
  const [boxes, setBoxes] = useState<SignatureBoxModel[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<EstagioRole | null>(null);
  const [drawing, setDrawing] = useState(true);

  const [pdfPages, setPdfPages] = useState<PdfPageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const viewerRef = useRef<PdfViewerHandle | null>(null);

  // Carrega cursos em que o professor está associado + conta estágios por curso.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingCourses(true);
      try {
        const db = await getDbRuntime();
        const courseSnaps = await getDocs(
          query(collection(db, "courses"), where("schoolId", "==", schoolId))
        );
        const relevant = courseSnaps.docs.filter((c) => {
          const data = c.data() as {
            courseDirectorId?: string;
            teacherIds?: string[];
            supportingTeacherIds?: string[];
          };
          return (
            data.courseDirectorId === professorUid ||
            (Array.isArray(data.teacherIds) && data.teacherIds.includes(professorUid)) ||
            (Array.isArray(data.supportingTeacherIds) &&
              data.supportingTeacherIds.includes(professorUid))
          );
        });
        const counts = await Promise.all(
          relevant.map(async (c) => {
            const countSnap = await getDocs(
              query(collection(db, "estagios"), where("alunoCourseId", "==", c.id))
            );
            return countSnap.size;
          })
        );
        if (cancelled) return;
        setCourses(
          relevant.map((c, idx) => ({
            id: c.id,
            nome: (c.data() as { nome?: string }).nome ?? c.id,
            estagiosCount: counts[idx] ?? 0,
          }))
        );
      } catch (err) {
        console.error("[v0] broadcast courses load failed", err);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, professorUid, schoolId]);

  useEffect(() => {
    if (!open) {
      setStep("meta");
      setCourseIds([]);
      setFile(null);
      setFileBytes(null);
      setFileMimeType("");
      setFileExtension("");
      setNome("");
      setDescricao("");
      setCategoria("outros");
      setAccessRoles(["diretor", "professor", "tutor", "aluno"]);
      setEnableSignatureFlow(false);
      setSignatureRoles([]);
      setBoxes([]);
      setSelectedBoxId(null);
      setActiveRole(null);
      setDrawing(true);
      setPdfPages([]);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const selectedCourses = useMemo(
    () => courses.filter((c) => courseIds.includes(c.id)),
    [courses, courseIds]
  );

  const selectedEstagiosCount = useMemo(
    () => selectedCourses.reduce((sum, c) => sum + c.estagiosCount, 0),
    [selectedCourses]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const meta = resolveFileMeta(selected);
    if (!meta) {
      setError("Apenas ficheiros PDF, DOCX ou XLSX são aceites.");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError("O ficheiro deve ter no máximo 20 MB.");
      return;
    }
    const buffer = new Uint8Array(await selected.arrayBuffer());
    setFile(selected);
    setFileBytes(buffer);
    setFileMimeType(meta.mimeType);
    setFileExtension(meta.extension);

    if (!meta.isPdf) {
      setEnableSignatureFlow(false);
      setSignatureRoles([]);
      setBoxes([]);
      setSelectedBoxId(null);
      setActiveRole(null);
    }

    setError(null);
  };

  const toggleCourse = (courseId: string) => {
    setCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const toggleRole = (
    role: EstagioRole,
    list: EstagioRole[],
    setter: (next: EstagioRole[]) => void
  ) => {
    const next = list.includes(role) ? list.filter((r) => r !== role) : [...list, role];
    setter(next);
    if (setter === setSignatureRoles && !next.includes(activeRole as EstagioRole)) {
      setActiveRole(next[0] ?? null);
    }
  };

  const removeBox = (boxId: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));
    if (selectedBoxId === boxId) setSelectedBoxId(null);
  };

  const isPdfFile = fileExtension === "pdf";
  const shouldConfigureSignatures = isPdfFile && enableSignatureFlow;

  const goToPosition = () => {
    if (courseIds.length === 0) {
      setError("Selecione pelo menos uma turma (curso) de destino.");
      return;
    }
    if (!nome.trim()) {
      setError("Indique o nome do documento.");
      return;
    }
    if (!file) {
      setError("Selecione um ficheiro para avançar.");
      return;
    }
    if (shouldConfigureSignatures && signatureRoles.length === 0) {
      setError("Selecione pelo menos um cargo que tem de assinar.");
      return;
    }
    setError(null);
    setStep("position");
  };

  const handleSubmit = async () => {
    if (!file || !fileBytes) {
      setError("Ficheiro em falta.");
      return;
    }
    if (courseIds.length === 0) {
      setError("Selecione pelo menos uma turma (curso) de destino.");
      return;
    }
    if (shouldConfigureSignatures && signatureRoles.length === 0) {
      setError("Selecione pelo menos um cargo que tem de assinar.");
      return;
    }
    if (shouldConfigureSignatures && boxes.length === 0) {
      setError("Adicione pelo menos uma caixa de assinatura.");
      return;
    }

    const effectiveSignatureRoles = shouldConfigureSignatures ? signatureRoles : [];
    const effectiveBoxes = shouldConfigureSignatures ? boxes : [];

    setSubmitting(true);
    setError(null);
    try {
      // 1) Upload do PDF partilhado (um só ficheiro, reutilizado em todos os estágios).
      const storage = await getStorageRuntime();
      const extension = fileExtension || resolveExtension(file.name) || "pdf";
      const primaryCourseId = courseIds[0] ?? "multi";
      const storagePath = `broadcast/${schoolId}/${primaryCourseId}/${Date.now()}.${extension}`;
      // Nota: caminhos fora de /estagios/{id}/documentos são bloqueados pelas
      // storage rules, pelo que usamos o path de estágios do próprio professor
      // como prefixo neutral. Como fallback simples, guardamos no estagio do
      // próprio ficheiro replicado (aqui usamos um bucket genérico por curso).
      //
      // Para evitar problemas de rules, reutilizamos o mesmo fileUrl para
      // cada estágio (o backend grava apenas a URL e o path original).
      const sRef = ref(
        storage,
        `estagios/__broadcast__/${primaryCourseId}/${Date.now()}.${extension}`
      );
      await uploadBytes(sRef, fileBytes, {
        contentType: fileMimeType || file.type || "application/octet-stream",
      });
      const downloadUrl = await getDownloadURL(sRef);

      const res = await fetch("/api/estagios/broadcast/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseIds,
          nome: nome.trim(),
          descricao,
          categoria,
          accessRoles,
          signatureRoles: effectiveSignatureRoles,
          signatureBoxes: effectiveBoxes,
          currentFileUrl: downloadUrl,
          currentFilePath: sRef.fullPath,
          fileMimeType: fileMimeType || file.type || "application/octet-stream",
          fileExtension: extension,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: number;
        total?: number;
        courseIds?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha a difundir o documento.");
        return;
      }
      onSuccess?.({
        courseIds: Array.isArray(data.courseIds) ? data.courseIds : courseIds,
        created: data.created ?? 0,
        total: data.total ?? 0,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-6xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {step === "meta"
              ? "Difundir documento por turma"
              : "Posicionar caixas de assinatura"}
          </DialogTitle>
          <DialogDescription>
            {step === "meta"
              ? "Carrega o mesmo documento em todos os estágios ativos das turmas selecionadas, com as mesmas permissões."
              : "Desenhe sobre o PDF onde cada cargo deve assinar. Estas caixas serão aplicadas em TODOS os estágios das turmas selecionadas."}
          </DialogDescription>
        </DialogHeader>

        {step === "meta" ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Turmas (cursos) de destino</Label>
              {loadingCourses ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar cursos...
                </div>
              ) : courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não está associado a nenhum curso. Peça ao administrador
                  escolar para o associar.
                </p>
              ) : (
                <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {courses.map((c) => {
                    const selected = courseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourse(c.id)}
                        className={`rounded-md border px-3 py-2 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.estagiosCount} estágio(s)</p>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedCourses.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Vai difundir para {selectedEstagiosCount} estágio(s) em {selectedCourses.length} turma(s) selecionada(s).
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="broadcast-nome">Nome do documento</Label>
                <Input
                  id="broadcast-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Regulamento Interno"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="broadcast-categoria">Categoria</Label>
                <Input
                  id="broadcast-categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex.: regulamento"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="broadcast-desc">Descrição</Label>
              <Textarea
                id="broadcast-desc"
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Quem pode visualizar</Label>
              <div className="flex flex-wrap gap-2">
                {(["diretor", "professor", "tutor", "aluno"] as EstagioRole[]).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={accessRoles.includes(role) ? "default" : "outline"}
                    onClick={() => toggleRole(role, accessRoles, setAccessRoles)}
                  >
                    {ROLE_LABEL[role]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assinatura digital</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  id="broadcast-signatures-enabled"
                  type="checkbox"
                  checked={enableSignatureFlow}
                  disabled={!file || !isPdfFile}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setEnableSignatureFlow(next);
                    if (next) {
                      setActiveRole(signatureRoles[0] ?? null);
                    } else {
                      setSelectedBoxId(null);
                      setActiveRole(null);
                    }
                  }}
                />
                <label htmlFor="broadcast-signatures-enabled">Ativar caixas de assinatura (apenas PDF)</label>
              </div>
              {!file ? (
                <p className="text-xs text-muted-foreground">
                  Selecione primeiro um ficheiro para configurar assinatura digital.
                </p>
              ) : !isPdfFile ? (
                <p className="text-xs text-muted-foreground">
                  Ficheiros DOCX e XLSX são difundidos sem caixas de assinatura.
                </p>
              ) : null}
            </div>

            {shouldConfigureSignatures ? (
              <div className="space-y-2">
                <Label>Quem assina</Label>
                <div className="flex flex-wrap gap-2">
                  {(["diretor", "professor", "tutor", "aluno"] as EstagioRole[]).map((role) => (
                    <Button
                      key={role}
                      type="button"
                      size="sm"
                      variant={signatureRoles.includes(role) ? "default" : "outline"}
                      onClick={() => toggleRole(role, signatureRoles, setSignatureRoles)}
                      style={
                        signatureRoles.includes(role)
                          ? { backgroundColor: COLOR_BY_ROLE[role], color: "white" }
                          : undefined
                      }
                    >
                      {ROLE_LABEL[role]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="broadcast-file">Ficheiro (PDF, DOCX ou XLSX)</Label>
              <Input
                id="broadcast-file"
                type="file"
                accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
              />
              {file ? (
                <p className="text-xs text-muted-foreground">
                  Selecionado: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
              <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg bg-muted/30 p-3">
                <PdfViewer
                  ref={viewerRef}
                  fileBytes={fileBytes ?? undefined}
                  scale={1.15}
                  onPagesReady={(p) => setPdfPages(p)}
                  renderPageOverlay={(info) => (
                    <SignatureBoxEditor
                      boxes={boxes}
                      onChange={setBoxes}
                      selectedBoxId={selectedBoxId}
                      onSelectBox={setSelectedBoxId}
                      pageNumber={info.pageNumber}
                      pageWidth={info.width}
                      pageHeight={info.height}
                      activeRole={activeRole}
                      drawingEnabled={drawing}
                    />
                  )}
                />
              </div>
              <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-3 lg:w-80">
                <div>
                  <p className="text-sm font-semibold">Cargo a desenhar</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {signatureRoles.map((role) => (
                      <Button
                        key={role}
                        type="button"
                        size="sm"
                        variant={activeRole === role ? "default" : "outline"}
                        onClick={() => setActiveRole(role)}
                        style={
                          activeRole === role
                            ? { backgroundColor: COLOR_BY_ROLE[role], color: "white" }
                            : undefined
                        }
                      >
                        {ROLE_LABEL[role]}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      id="broadcast-drawing"
                      checked={drawing}
                      onChange={(e) => setDrawing(e.target.checked)}
                    />
                    <label htmlFor="broadcast-drawing">Modo desenho ativo</label>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Arraste no PDF para adicionar uma caixa. Todas as caixas serão
                    replicadas em cada estágio da turma.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    Caixas ({boxes.length}) • Páginas: {pdfPages.length}
                  </p>
                  <div className="mt-2 space-y-1">
                    {boxes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Ainda não há caixas definidas.
                      </p>
                    ) : (
                      boxes.map((box) => (
                        <div
                          key={box.id}
                          className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-sm"
                              style={{
                                background: box.role
                                  ? `${COLOR_BY_ROLE[box.role]}55`
                                  : "#94a3b855",
                                border: `2px solid ${
                                  box.role ? COLOR_BY_ROLE[box.role] : "#64748b"
                                }`,
                              }}
                            />
                            <span>
                              {box.role ? ROLE_LABEL[box.role] : "—"} • p.{box.page}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-destructive hover:text-destructive"
                            onClick={() => removeBox(box.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedCourses.length > 0 ? (
                  <Badge variant="secondary" className="w-full justify-center">
                    {selectedEstagiosCount} estágio(s) em {selectedCourses.length} turma(s)
                  </Badge>
                ) : null}

                {error ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2">
          {step === "position" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("meta")}
              disabled={submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          ) : (
            <span />
          )}
          {step === "meta" ? (
            shouldConfigureSignatures ? (
              <Button
                type="button"
                onClick={goToPosition}
                disabled={!file || courseIds.length === 0 || submitting}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Continuar
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!file || courseIds.length === 0 || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />A difundir...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Difundir documento
                  </>
                )}
              </Button>
            )
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />A difundir...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Difundir documento
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
