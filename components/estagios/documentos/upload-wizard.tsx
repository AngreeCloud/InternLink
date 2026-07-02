"use client";

import { useEffect, useRef, useState } from "react";
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
import { Upload, Loader2 } from "lucide-react";
import { SignatureRolesPreview } from "@/components/estagios/pdf/signature-roles-preview";
import type { EstagioRole } from "@/lib/estagios/permissions";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";

export type UploadWizardDoc = {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  templateCode?: string;
  signatureBoxes: SignatureBoxModel[];
  signatureRoles: EstagioRole[];
  accessRoles: EstagioRole[];
  currentFileUrl?: string;
  currentFilePath?: string;
  fileMimeType?: string;
  fileExtension?: string;
  estado?: string;
  isNew?: boolean;
};

export type UploadWizardProps = {
  estagioId: string;
  doc: UploadWizardDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

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

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function resolveExtension(fileName: string): "pdf" | "docx" | "xlsx" | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
  if (!match?.[1]) return null;
  const ext = match[1];
  if (ext === "pdf" || ext === "docx" || ext === "xlsx") return ext as "pdf" | "docx" | "xlsx";
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

export function UploadWizard({ estagioId, doc, open, onOpenChange, onSuccess }: UploadWizardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);

  // rastreia quando fileBytes é limpo inesperadamente
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      // fecho normal — ignorar
    }
    prevOpen.current = open;
  }, [open]);

  const fileBytesRef = useRef(fileBytes);
  useEffect(() => {
    if (fileBytes === null && fileBytesRef.current !== null && fileBytesRef.current.length > 0) {
      console.error("[UploadWizard] fileBytes CLEARED! previous length =", fileBytesRef.current.length);
    }
    fileBytesRef.current = fileBytes;
  }, [fileBytes]);
  const [fileMimeType, setFileMimeType] = useState(doc.fileMimeType ?? "");
  const [fileExtension, setFileExtension] = useState((doc.fileExtension ?? "").toLowerCase());

  const [nome, setNome] = useState(doc.nome);
  const [descricao, setDescricao] = useState(doc.descricao);
  const [enableSignatureFlow, setEnableSignatureFlow] = useState(
    (doc.signatureRoles?.length ?? 0) > 0 || (doc.signatureBoxes?.length ?? 0) > 0
  );
  const [signatureRoles, setSignatureRoles] = useState<EstagioRole[]>(doc.signatureRoles);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const readingFile = useRef(false);
  const lastFileKey = useRef("");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setFileBytes(null);
      setFileMimeType(doc.fileMimeType ?? "");
      setFileExtension((doc.fileExtension ?? "").toLowerCase());
      setNome(doc.nome);
      setDescricao(doc.descricao);
      setEnableSignatureFlow((doc.signatureRoles?.length ?? 0) > 0 || (doc.signatureBoxes?.length ?? 0) > 0);
      setSignatureRoles(doc.signatureRoles);
      setError(null);
      setSubmitting(false);
      readingFile.current = false;
      lastFileKey.current = "";
    }
  }, [open, doc]);

  const isPdfFile = fileExtension === "pdf";
  const shouldConfigureSignatures = isPdfFile && enableSignatureFlow;

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
      const buffer = new Uint8Array(await selected.arrayBuffer());
      console.log(`[UploadWizard] fileBytes.length = ${buffer.length}, file.size = ${selected.size}`);
      if (buffer.length === 0) {
        setError("O ficheiro parece estar vazio. Tente novamente.");
        return;
      }
      lastFileKey.current = key;
      setFile(selected);
      setFileBytes(buffer);
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

  const toggleRole = (role: EstagioRole) => {
    setSignatureRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (!fileBytes || !file) {
      setError("Ficheiro em falta.");
      return;
    }
    if (fileBytes.length === 0) {
      console.error(`[UploadWizard] SUBMIT_BUG: fileBytes.length=0, file?.size=${file?.size}, file?.name=${file?.name}`);
      setError("O ficheiro selecionado está vazio (0 bytes).");
      return;
    }
    if (shouldConfigureSignatures && signatureRoles.length === 0) {
      setError("Selecione pelo menos um cargo que tem de assinar.");
      return;
    }

    const boxes = shouldConfigureSignatures ? generateAutoBoxes(signatureRoles) : [];
    const effectiveSignatureRoles = shouldConfigureSignatures ? signatureRoles : [];

    setSubmitting(true);
    setError(null);
    try {
      const storage = await getStorageRuntime();
      const newVersion = (doc.estado === "pendente" ? 1 : 0) + 1;
      const extension = fileExtension || resolveExtension(file.name) || "pdf";
      const storagePath = `estagios/${estagioId}/documentos/${doc.id}/v${Date.now()}.${extension}`;
      const sRef = ref(storage, storagePath);
      await uploadBytes(sRef, fileBytes, {
        contentType: fileMimeType || file.type || "application/octet-stream",
      });
      const downloadUrl = await getDownloadURL(sRef);

      const body = {
        nome: nome.trim(),
        descricao: descricao,
        signatureRoles: effectiveSignatureRoles,
        signatureBoxes: boxes,
        currentFileUrl: downloadUrl,
        currentFilePath: storagePath,
        fileMimeType: fileMimeType || file.type || "application/octet-stream",
        fileExtension: extension,
        bumpVersion: true,
        estado: shouldConfigureSignatures ? "aguarda_assinatura" : "pendente",
        versionNotes: shouldConfigureSignatures
          ? "Versão com assinatura digital configurada."
          : "Versão carregada sem assinatura digital obrigatória.",
        ...(doc.isNew
          ? {
              categoria: doc.categoria || "outros",
              accessRoles: doc.accessRoles?.length
                ? doc.accessRoles
                : ["diretor", "professor", "tutor", "aluno"],
            }
          : {}),
      };

      const res = doc.isNew
        ? await fetch(`/api/estagios/${estagioId}/documentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/estagios/${estagioId}/documentos/${doc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha a gravar o documento.");
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto w-[94vw] sm:max-w-[52rem]">
        <DialogHeader>
          <DialogTitle>Carregar documento</DialogTitle>
          <DialogDescription>
            Indique os metadados do documento e carregue o ficheiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="wizard-nome">Nome do documento</Label>
            <Input id="wizard-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-descricao">Descrição</Label>
            <Textarea
              id="wizard-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Assinatura digital</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                id="wizard-signatures-enabled"
                checked={enableSignatureFlow}
                disabled={!file || !isPdfFile}
                onChange={(e) => {
                  setEnableSignatureFlow(e.target.checked);
                  if (!e.target.checked) setSignatureRoles([]);
                }}
              />
              <label htmlFor="wizard-signatures-enabled">Ativar assinatura digital (apenas PDF)</label>
            </div>
            {!file ? (
              <p className="text-xs text-muted-foreground">
                Selecione primeiro um ficheiro para configurar a assinatura digital.
              </p>
            ) : !isPdfFile ? (
              <p className="text-xs text-muted-foreground">
                Ficheiros DOCX e XLSX são carregados sem assinatura digital.
              </p>
            ) : null}
          </div>

          {shouldConfigureSignatures ? (
            <div className="space-y-2">
              <Label>Cargos que assinam</Label>
              <div className="flex flex-wrap gap-2">
                {(["diretor", "professor", "tutor", "aluno"] as EstagioRole[]).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={signatureRoles.includes(role) ? "default" : "outline"}
                    onClick={() => toggleRole(role)}
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
            <Label htmlFor="wizard-file">Ficheiro (PDF, DOCX ou XLSX)</Label>
            <Input
              id="wizard-file"
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
          <Button type="button" onClick={handleSubmit} disabled={!file || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Publicar documento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
