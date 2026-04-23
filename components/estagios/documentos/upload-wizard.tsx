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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Upload, Loader2, Trash2 } from "lucide-react";
import { PdfViewer, type PdfPageInfo, type PdfViewerHandle } from "@/components/estagios/pdf/pdf-viewer";
import { SignatureBoxEditor } from "@/components/estagios/pdf/signature-box-editor";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";
import type { EstagioRole } from "@/lib/estagios/permissions";

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
  estado?: string;
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

export function UploadWizard({ estagioId, doc, open, onOpenChange, onSuccess }: UploadWizardProps) {
  const [step, setStep] = useState<"meta" | "position">("meta");
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);

  const [nome, setNome] = useState(doc.nome);
  const [descricao, setDescricao] = useState(doc.descricao);
  const [signatureRoles, setSignatureRoles] = useState<EstagioRole[]>(doc.signatureRoles);
  const [boxes, setBoxes] = useState<SignatureBoxModel[]>(doc.signatureBoxes ?? []);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<EstagioRole | null>(signatureRoles[0] ?? null);
  const [drawing, setDrawing] = useState(true);

  const [pdfPages, setPdfPages] = useState<PdfPageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const viewerRef = useRef<PdfViewerHandle | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("meta");
      setFile(null);
      setFileBytes(null);
      setNome(doc.nome);
      setDescricao(doc.descricao);
      setSignatureRoles(doc.signatureRoles);
      setBoxes(doc.signatureBoxes ?? []);
      setSelectedBoxId(null);
      setActiveRole(doc.signatureRoles[0] ?? null);
      setDrawing(true);
      setPdfPages([]);
      setError(null);
      setSubmitting(false);
    }
  }, [open, doc]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setError("Apenas ficheiros PDF são aceites.");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError("O ficheiro deve ter no máximo 20 MB.");
      return;
    }
    const buffer = new Uint8Array(await selected.arrayBuffer());
    setFile(selected);
    setFileBytes(buffer);
    setError(null);
  };

  const toggleRole = (role: EstagioRole) => {
    setSignatureRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      if (!next.includes(activeRole as EstagioRole)) {
        setActiveRole(next[0] ?? null);
      }
      return next;
    });
  };

  const removeBox = (boxId: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));
    if (selectedBoxId === boxId) setSelectedBoxId(null);
  };

  const selectedBox = useMemo(() => boxes.find((b) => b.id === selectedBoxId) ?? null, [boxes, selectedBoxId]);

  const goToPosition = () => {
    if (!file) {
      setError("Selecione um PDF para avançar.");
      return;
    }
    if (!nome.trim()) {
      setError("Indique o nome do documento.");
      return;
    }
    if (signatureRoles.length === 0) {
      setError("Selecione pelo menos um cargo que tem de assinar.");
      return;
    }
    setError(null);
    setStep("position");
  };

  const handleSubmit = async () => {
    if (!fileBytes || !file) {
      setError("Ficheiro PDF em falta.");
      return;
    }
    if (boxes.length === 0) {
      setError("Adicione pelo menos uma caixa de assinatura.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // 1) Upload ao Storage: path por versão.
      const storage = await getStorageRuntime();
      const newVersion = (doc.estado === "pendente" ? 1 : 0) + 1; // placeholder para nomear o ficheiro
      const storagePath = `estagios/${estagioId}/documentos/${doc.id}/v${Date.now()}.pdf`;
      const sRef = ref(storage, storagePath);
      await uploadBytes(sRef, fileBytes, { contentType: "application/pdf" });
      const downloadUrl = await getDownloadURL(sRef);

      // 2) Atualiza o documento com novo PDF + caixas.
      const res = await fetch(`/api/estagios/${estagioId}/documentos/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao,
          signatureRoles,
          signatureBoxes: boxes,
          currentFileUrl: downloadUrl,
          currentFilePath: storagePath,
          bumpVersion: true,
          estado: "aguarda_assinatura",
          versionNotes: `Versão inicial carregada pelo Diretor de Curso.`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; newVersion?: number };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha a gravar o documento.");
        return;
      }

      onSuccess();
      onOpenChange(false);
      // força refresh silencioso (o parent vai re-fetch).
      // estado inicial já reposto pelo efeito em `open=false`.
      void newVersion;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "meta" ? "Carregar documento" : "Posicionar caixas de assinatura"}
          </DialogTitle>
          <DialogDescription>
            {step === "meta"
              ? "Indique os metadados do documento e carregue o PDF original."
              : "Desenhe sobre o PDF a área onde cada cargo deve assinar."}
          </DialogDescription>
        </DialogHeader>

        {step === "meta" ? (
          <div className="space-y-5 overflow-y-auto pr-1">
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

            <div className="space-y-2">
              <Label htmlFor="wizard-file">PDF Original</Label>
              <Input id="wizard-file" type="file" accept="application/pdf" onChange={handleFileChange} />
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
            <div className="flex h-full gap-3">
              <div className="flex-1 overflow-y-auto bg-muted/30 py-3">
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
              <aside className="w-72 shrink-0 space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-3">
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
                      id="drawing-enabled"
                      checked={drawing}
                      onChange={(e) => setDrawing(e.target.checked)}
                    />
                    <label htmlFor="drawing-enabled">Modo desenho ativo</label>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Arraste no PDF para adicionar uma caixa. Clique numa caixa para selecionar/editar.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    Caixas ({boxes.length}) • Páginas: {pdfPages.length}
                  </p>
                  <div className="mt-2 space-y-1">
                    {boxes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ainda não há caixas definidas.</p>
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

                {selectedBox ? (
                  <div>
                    <Badge variant="secondary">Caixa selecionada</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mova ou redimensione na pré-visualização à esquerda.
                    </p>
                  </div>
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
            <Button type="button" variant="ghost" onClick={() => setStep("meta")} disabled={submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          ) : (
            <span />
          )}
          {step === "meta" ? (
            <Button type="button" onClick={goToPosition} disabled={!file}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
