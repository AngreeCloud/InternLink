"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Eye, EyeOff, PenTool } from "lucide-react";

type Documento = {
  id: string;
  nome: string;
  estagioTitulo: string;
  visibilidade: "todos" | "tutores";
  requerAssinatura: boolean;
  assinantes: string[];
  tipo: string;
  createdAt: string;
};

type Estagio = {
  id: string;
  titulo: string;
  alunoNome: string;
  tutorEmail: string;
};

export function DocumentManager() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [docNome, setDocNome] = useState("");
  const [selectedEstagio, setSelectedEstagio] = useState("");
  const [visibilidade, setVisibilidade] = useState<"todos" | "tutores">("todos");
  const [requerAssinatura, setRequerAssinatura] = useState(false);
  const [assinantes, setAssinantes] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as { schoolId?: string };
      if (!userData.schoolId) return;
      setSchoolId(userData.schoolId);

      // Load documents
      try {
        const docsSnap = await getDocs(
          query(collection(db, "documentos"), where("schoolId", "==", userData.schoolId))
        );
        const list: Documento[] = docsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as {
            nome?: string;
            estagioTitulo?: string;
            visibilidade?: string;
            requerAssinatura?: boolean;
            assinantes?: string[];
            tipo?: string;
            createdAt?: { toDate: () => Date };
          };
          return {
            id: docSnap.id,
            nome: data.nome || "—",
            estagioTitulo: data.estagioTitulo || "—",
            visibilidade: (data.visibilidade as "todos" | "tutores") || "todos",
            requerAssinatura: data.requerAssinatura || false,
            assinantes: data.assinantes || [],
            tipo: data.tipo || "outro",
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          };
        });
        setDocumentos(list);
      } catch { /* ignore */ }

      // Load estágios
      try {
        const estagiosSnap = await getDocs(
          query(collection(db, "estagios"), where("schoolId", "==", userData.schoolId))
        );
        setEstagios(
          estagiosSnap.docs.map((d) => {
            const data = d.data() as {
              titulo?: string;
              alunoNome?: string;
              tutorEmail?: string;
            };
            return {
              id: d.id,
              titulo: data.titulo || "—",
              alunoNome: data.alunoNome || "—",
              tutorEmail: data.tutorEmail || "—",
            };
          })
        );
      } catch { /* ignore */ }
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, () => {
        loadData();
      });
    })();

    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        alert("Apenas ficheiros PDF ou DOCX são permitidos.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const toggleAssinante = (role: string) => {
    setAssinantes((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleUpload = async () => {
    if (!docNome.trim() || !selectedEstagio) return;
    setSubmitting(true);
    try {
      const db = await getDbRuntime();
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const estagio = estagios.find((e) => e.id === selectedEstagio);

      // Store document metadata in Firestore
      // File upload to Cloud Storage would be implemented here
      await addDoc(collection(db, "documentos"), {
        nome: docNome.trim(),
        estagioId: selectedEstagio,
        estagioTitulo: estagio?.titulo || "",
        schoolId,
        professorId: user.uid,
        visibilidade,
        requerAssinatura,
        assinantes: requerAssinatura ? assinantes : [],
        assinaturas: {},
        tipo: selectedFile?.type === "application/pdf" ? "pdf" : "docx",
        fileName: selectedFile?.name || "",
        fileSize: selectedFile?.size || 0,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setDocNome("");
      setSelectedEstagio("");
      setVisibilidade("todos");
      setRequerAssinatura(false);
      setAssinantes([]);
      setSelectedFile(null);
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Erro ao carregar documento:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getVisibilidadeLabel = (v: string) => {
    switch (v) {
      case "todos":
        return "Alunos e Tutores";
      case "tutores":
        return "Apenas Tutores";
      default:
        return v;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Documentos</h1>
          <p className="text-muted-foreground">
            Carregar documentos e definir visibilidade e assinaturas digitais.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Carregar Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Carregar Documento</DialogTitle>
              <DialogDescription>
                Selecione um estágio e configure a visibilidade e assinaturas do documento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="docNome">Nome do Documento</Label>
                <Input
                  id="docNome"
                  placeholder="Ex: Protocolo de Estágio"
                  value={docNome}
                  onChange={(e) => setDocNome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="docEstagio">Estágio Associado</Label>
                <Select value={selectedEstagio} onValueChange={setSelectedEstagio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    {estagios.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.titulo} — {e.alunoNome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="docFile">Ficheiro (PDF/DOCX)</Label>
                <Input
                  id="docFile"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select
                  value={visibilidade}
                  onValueChange={(v) => setVisibilidade(v as "todos" | "tutores")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">
                      Visível para Alunos e Tutores
                    </SelectItem>
                    <SelectItem value="tutores">
                      Visível apenas para Tutores
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-primary" />
                    <Label className="cursor-pointer">Requer Assinatura Digital</Label>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={requerAssinatura}
                    onClick={() => {
                      setRequerAssinatura(!requerAssinatura);
                      if (requerAssinatura) setAssinantes([]);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      requerAssinatura ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        requerAssinatura ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {requerAssinatura && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Selecione quem deve assinar este documento:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["professor", "aluno", "tutor"].map((role) => (
                        <Button
                          key={role}
                          type="button"
                          variant={assinantes.includes(role) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleAssinante(role)}
                        >
                          {role === "professor" && "Professor"}
                          {role === "aluno" && "Aluno"}
                          {role === "tutor" && "Tutor"}
                        </Button>
                      ))}
                    </div>
                    {assinantes.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Assinantes selecionados: {assinantes.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button onClick={handleUpload} disabled={submitting} className="w-full">
                {submitting ? "A carregar..." : "Carregar Documento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
          </CardTitle>
          <CardDescription>
            {loading ? "A carregar..." : `${documentos.length} documento(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar documentos...</p>
          ) : documentos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum documento</h3>
              <p className="text-muted-foreground">
                Carregue o primeiro documento para um estágio.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documentos.map((documento) => (
                <div
                  key={documento.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{documento.nome}</h4>
                      <Badge variant="outline" className="text-xs">
                        {documento.tipo.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Estágio: {documento.estagioTitulo}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {documento.visibilidade === "todos" ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                        <span>{getVisibilidadeLabel(documento.visibilidade)}</span>
                      </div>
                      {documento.requerAssinatura && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <PenTool className="h-3 w-3" />
                          <span>
                            Assinatura: {documento.assinantes.join(", ") || "configurar"}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Carregado em: {documento.createdAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
