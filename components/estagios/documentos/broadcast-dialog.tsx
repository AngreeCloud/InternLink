"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageRuntime } from "@/lib/firebase-runtime";
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
import { Loader2, Megaphone, Upload } from "lucide-react";
import { SignatureRolesPreview } from "@/components/estagios/pdf/signature-roles-preview";
import type { EstagioRole } from "@/lib/estagios/permissions";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";

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

function generateAutoBoxes(roles: EstagioRole[]): SignatureBoxModel[] {
  if (roles.length === 0) return [];
  const boxW = 0.44;
  const boxH = 0.057;
  const x = (1 - boxW) / 2;
  const startY = 1 - (roles.length * (boxH + 0.015) + 0.05);
  return roles.map((role, i) => {
    const y = Math.max(startY + i * (boxH + 0.015), 0.025);
    return {
      id: `auto-${role}`,
      role,
      page: 1,
      x,
      y,
      width: boxW,
      height: boxH,
    };
  });
}

type CourseOption = {
  id: string;
  nome: string;
  estagiosCount: number;
};

export type BroadcastDialogProps = {
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { courseIds: string[]; created: number; total: number }) => void;
};

export function BroadcastDialog({
  schoolId,
  open,
  onOpenChange,
  onSuccess,
}: BroadcastDialogProps) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileMimeType, setFileMimeType] = useState("");
  const [fileExtension, setFileExtension] = useState("");
  const fileDataRef = useRef<{ buffer: ArrayBuffer; mimeType: string; extension: string } | null>(null);

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const readingFile = useRef(false);
  const lastFileKey = useRef("");

  // Carrega cursos em que o professor está associado + conta estágios por curso.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingCourses(true);
      setCoursesError(null);
      try {
        const res = await fetch("/api/professor/broadcast-courses", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          courses?: CourseOption[];
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setCoursesError(data.error || "Não foi possível carregar as turmas.");
          return;
        }
        if (cancelled) return;
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      } catch (err) {
        console.error("[v0] broadcast courses load failed", err);
        if (!cancelled) setCoursesError("Não foi possível carregar as turmas.");
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCourseIds([]);
      setFile(null);
      setFileBytes(null);
      fileDataRef.current = null;
      setFileMimeType("");
      setFileExtension("");
      setNome("");
      setDescricao("");
      setCategoria("outros");
      setAccessRoles(["diretor", "professor", "tutor", "aluno"]);
      setEnableSignatureFlow(false);
      setSignatureRoles([]);
      setError(null);
      setCoursesError(null);
      setSubmitting(false);
      readingFile.current = false;
      lastFileKey.current = "";
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
    const key = `${selected.name}:${selected.size}:${selected.lastModified}`;
    if (key === lastFileKey.current && readingFile.current) return;
    if (readingFile.current) return;
    readingFile.current = true;
    try {
      const meta = resolveFileMeta(selected);
      if (!meta) {
        setError("Apenas ficheiros PDF, DOCX ou XLSX são aceites.");
        return;
      }
      if (selected.size > 20 * 1024 * 1024) {
        setError("O ficheiro deve ter no máximo 20 MB.");
        return;
      }
      const rawBuffer = await selected.arrayBuffer();
      console.log(`[BroadcastDialog] fileBytes.length = ${rawBuffer.byteLength}, file.size = ${selected.size}`);
      if (rawBuffer.byteLength === 0) {
        setError("O ficheiro parece estar vazio. Tente novamente.");
        return;
      }
      lastFileKey.current = key;
      fileDataRef.current = { buffer: rawBuffer, mimeType: meta.mimeType, extension: meta.extension };
      setFile(selected);
      setFileBytes(new Uint8Array(rawBuffer));
      setFileMimeType(meta.mimeType);
      setFileExtension(meta.extension);

      if (!meta.isPdf) {
        setEnableSignatureFlow(false);
        setSignatureRoles([]);
      }

      setError(null);
      event.target.value = "";
    } finally {
      readingFile.current = false;
    }
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
  };

  const isPdfFile = fileExtension === "pdf";
  const shouldConfigureSignatures = isPdfFile && enableSignatureFlow;

  const handleSubmit = async () => {
    if (!file) {
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

    const effectiveSignatureRoles = shouldConfigureSignatures ? signatureRoles : [];
    const effectiveBoxes = shouldConfigureSignatures ? generateAutoBoxes(signatureRoles) : [];

    setSubmitting(true);
    setError(null);
    try {
      // Use ref-stored buffer (not React state) to avoid binary data corruption
      let uploadBuffer = fileDataRef.current?.buffer ?? null;
      if (!uploadBuffer) {
        uploadBuffer = await file.arrayBuffer();
      }
      if (uploadBuffer.byteLength === 0) {
        setError("O ficheiro foi carregado com 0 bytes. Tente novamente.");
        setSubmitting(false);
        return;
      }

      const storage = await getStorageRuntime();
      const extension = fileExtension || resolveExtension(file.name) || "pdf";
      // Use sorted course IDs to build a stable, unique path independent of selection order
      const pathKey = [...courseIds].sort().join("_") || "multi";
      const sRef = ref(
        storage,
        `estagios/__broadcast__/${pathKey}/${Date.now()}.${extension}`
      );
      const uploadResult = await uploadBytes(sRef, uploadBuffer, {
        contentType: fileMimeType || file.type || "application/octet-stream",
      });
      if (!uploadResult.metadata || uploadResult.metadata.size === 0) {
        setError("O ficheiro foi carregado com 0 bytes. Tente novamente.");
        setSubmitting(false);
        return;
      }
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
          enableSignatureFlow: shouldConfigureSignatures,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        created?: number;
        total?: number;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao difundir documento.");
        return;
      }
      onSuccess?.({ courseIds, created: data.created ?? 0, total: data.total ?? 0 });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto w-[94vw] sm:max-w-[56rem]">
        <DialogHeader>
          <DialogTitle>
            <Megaphone className="mr-2 inline-block h-5 w-5" />
            Difundir documento
          </DialogTitle>
          <DialogDescription>
            Pode enviar o mesmo documento para uma ou mais turmas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Turmas de destino</Label>
            {loadingCourses ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />A carregar turmas...
              </div>
            ) : coursesError ? (
              <p className="text-sm text-destructive">{coursesError}</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma turma encontrada com estágios ativos.
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
                  if (!next) setSignatureRoles([]);
                }}
              />
              <label htmlFor="broadcast-signatures-enabled">Ativar assinatura digital (apenas PDF)</label>
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

          {fileBytes && isPdfFile ? (
            <SignatureRolesPreview
              fileBytes={fileBytes}
              signatureRoles={shouldConfigureSignatures ? signatureRoles : []}
            />
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
