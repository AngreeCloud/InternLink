"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  FileText,
  Clock,
  AlertCircle,
  Lock,
  Loader2,
  MessageSquare,
  ScrollText,
} from "lucide-react";

type PageState = {
  loading: boolean;
  authorized: boolean;

  // Student info
  studentName: string;
  escola: string;
  curso: string;

  // Estagio
  estagioId: string | null;
  estagioEstado: string;
  encarregadoConcordou: boolean;
  concordouAt: string | null;

  // Protocol doc
  protocolFileUrl: string | null;
  protocolFileName: string | null;

  // Reports
  relatorios: Array<{
    id: string;
    titulo: string;
    dataSubmissao: string;
    estado: "pendente" | "aprovado" | "rejeitado";
    fileUrl: string | null;
  }>;

  // Occurrences timeline
  ocorrencias: Array<{
    id: string;
    tipo: string;
    descricao: string;
    data: string;
  }>;
};

type EsDocData = {
  nome?: string;
  fileUrl?: string;
  fileName?: string;
  url?: string;
  tipo?: string;
  uploadedAt?: { toDate?: () => Date } | null;
  createdAt?: { toDate?: () => Date } | null;
};

function formatDate(d: { toDate?: () => Date } | null | undefined): string {
  if (!d || typeof d.toDate !== "function") return "—";
  return d.toDate().toLocaleDateString("pt-PT");
}

const ACTIVE_STATES = new Set(["ativo", "em_curso", "em curso", "iniciado", "aberto"]);
const COMPLETED_STATES = new Set(["concluido", "concluído", "finalizado", "terminado", "encerrado"]);

function mapRelatorioEstado(estado?: string): "pendente" | "aprovado" | "rejeitado" {
  const s = (estado || "").toLowerCase();
  if (s === "aprovado") return "aprovado";
  if (s === "rejeitado") return "rejeitado";
  return "pendente";
}

function RelatorioEstadoBadge({ estado }: { estado: "pendente" | "aprovado" | "rejeitado" }) {
  if (estado === "aprovado") return <Badge className="bg-green-100 text-green-700 border-green-200">Aprovado</Badge>;
  if (estado === "rejeitado") return <Badge variant="destructive">Rejeitado</Badge>;
  return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
}

export function EncarregadoEducandoDetail({ studentId }: { studentId: string }) {
  const [state, setState] = useState<PageState>({
    loading: true,
    authorized: false,
    studentName: "",
    escola: "",
    curso: "",
    estagioId: null,
    estagioEstado: "",
    encarregadoConcordou: false,
    concordouAt: null,
    protocolFileUrl: null,
    protocolFileName: null,
    relatorios: [],
    ocorrencias: [],
  });
  const [concordandoLoading, setConcordandoLoading] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    const db = await getDbRuntime();

    try {
      // Verify EE is authorized for this student
      const eeSnap = await getDoc(doc(db, "users", userId));
      if (!eeSnap.exists()) {
        setState((p) => ({ ...p, loading: false, authorized: false }));
        return;
      }
      const eeData = eeSnap.data() as { educandoIds?: string[]; role?: string };
      if (eeData.role !== "encarregado" || !Array.isArray(eeData.educandoIds) || !eeData.educandoIds.includes(studentId)) {
        setState((p) => ({ ...p, loading: false, authorized: false }));
        return;
      }

      // Load student
      const studentSnap = await getDoc(doc(db, "users", studentId));
      if (!studentSnap.exists()) {
        setState((p) => ({ ...p, loading: false, authorized: false }));
        return;
      }
      const sd = studentSnap.data() as {
        nome?: string;
        escola?: string;
        curso?: string;
        schoolId?: string;
      };

      let escolaNome = sd.escola || "—";
      if (sd.schoolId) {
        try {
          const schoolSnap = await getDoc(doc(db, "schools", sd.schoolId));
          if (schoolSnap.exists()) {
            const sc = schoolSnap.data() as { name?: string; shortName?: string };
            escolaNome = sc.name || sc.shortName || escolaNome;
          }
        } catch { /* ignore */ }
      }

      // Load estagio
      const estagiosSnap = await getDocs(
        query(collection(db, "estagios"), where("alunoId", "==", studentId))
      );
      const estagioDoc = estagiosSnap.docs[0];

      if (!estagioDoc) {
        setState((p) => ({
          ...p,
          loading: false,
          authorized: true,
          studentName: sd.nome || "—",
          escola: escolaNome,
          curso: sd.curso || "—",
        }));
        return;
      }

      const estagioId = estagioDoc.id;
      const ed = estagioDoc.data() as {
        estadoEstagio?: string;
        estado?: string;
        encarregadoConcordou?: boolean;
        encarregadoConcordouAt?: { toDate?: () => Date } | null;
      };

      const concordouAt = ed.encarregadoConcordouAt?.toDate?.()?.toLocaleDateString("pt-PT") || null;

      // Load protocol from documents subcollection
      let protocolFileUrl: string | null = null;
      let protocolFileName: string | null = null;
      try {
        const docsSnap = await getDocs(collection(db, "estagios", estagioId, "documents"));
        for (const d of docsSnap.docs) {
          const ddata = d.data() as EsDocData & { currentFileUrl?: string; fileExtension?: string };
          const tipo = (ddata.tipo || "").toLowerCase();
          if (tipo.includes("protocolo") || tipo === "protocol") {
            protocolFileUrl = ddata.currentFileUrl || ddata.fileUrl || ddata.url || null;
            protocolFileName = ddata.nome || ddata.fileName || "Protocolo.pdf";
            break;
          }
        }
      } catch { /* ignore */ }

      // Load sumários (reports)
      const sumariosSnap = await getDocs(collection(db, "estagios", estagioId, "sumarios"));
      const relatorios = sumariosSnap.docs.map((d) => {
        const ddata = d.data() as {
          titulo?: string;
          createdAt?: { toDate?: () => Date } | null;
          estado?: string;
          fileUrl?: string;
        };
        return {
          id: d.id,
          titulo: ddata.titulo || "Sumário",
          dataSubmissao: formatDate(ddata.createdAt),
          estado: mapRelatorioEstado(ddata.estado),
          fileUrl: ddata.fileUrl || null,
        };
      }).sort((a, b) => b.dataSubmissao.localeCompare(a.dataSubmissao, "pt-PT"));

      // Build occurrences timeline from combined events
      const ocorrencias: PageState["ocorrencias"] = [];

      // Check internship creation
      const estagioCreatedAt = (estagioDoc.data() as { createdAt?: { toDate?: () => Date } | null }).createdAt;
      if (estagioCreatedAt?.toDate) {
        ocorrencias.push({
          id: "estagio_criado",
          tipo: "Estágio criado",
          descricao: "Estágio FCT iniciado na plataforma.",
          data: estagioCreatedAt.toDate().toLocaleDateString("pt-PT"),
        });
      }

      if (protocolFileUrl) {
        ocorrencias.push({
          id: "protocolo_disponivel",
          tipo: "Protocolo disponível",
          descricao: "O protocolo de estágio foi carregado.",
          data: "—",
        });
      }

      if (ed.encarregadoConcordou && concordouAt) {
        ocorrencias.push({
          id: "protocolo_aceite",
          tipo: "Protocolo aceite pelo E.E.",
          descricao: "O Encarregado de Educação concordou com o protocolo.",
          data: concordouAt,
        });
      }

      for (const r of relatorios) {
        ocorrencias.push({
          id: `sumario_${r.id}`,
          tipo: "Sumário submetido",
          descricao: r.titulo,
          data: r.dataSubmissao,
        });
      }

      ocorrencias.sort((a, b) => {
        if (a.data === "—") return 1;
        if (b.data === "—") return -1;
        return b.data.localeCompare(a.data, "pt-PT");
      });

      const rawEstado = (ed.estadoEstagio || ed.estado || "").toLowerCase();
      let estagioEstado = "Pendente";
      if (ACTIVE_STATES.has(rawEstado)) estagioEstado = "Ativo";
      else if (COMPLETED_STATES.has(rawEstado)) estagioEstado = "Concluído";

      setState({
        loading: false,
        authorized: true,
        studentName: sd.nome || "—",
        escola: escolaNome,
        curso: sd.curso || "—",
        estagioId,
        estagioEstado,
        encarregadoConcordou: !!ed.encarregadoConcordou,
        concordouAt,
        protocolFileUrl,
        protocolFileName,
        relatorios,
        ocorrencias,
      });
    } catch (err) {
      console.error("[EE educando detail]", err);
      setState((p) => ({ ...p, loading: false }));
    }
  }, [studentId]);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) setState((p) => ({ ...p, loading: false }));
          return;
        }
        await loadData(user.uid);
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadData]);

  const handleConcordar = async () => {
    if (!state.estagioId || state.encarregadoConcordou) return;
    setConcordandoLoading(true);
    try {
      const db = await getDbRuntime();
      await updateDoc(doc(db, "estagios", state.estagioId), {
        encarregadoConcordou: true,
        encarregadoConcordouAt: serverTimestamp(),
      });
      const now = new Date().toLocaleDateString("pt-PT");
      setState((p) => ({
        ...p,
        encarregadoConcordou: true,
        concordouAt: now,
        ocorrencias: [
          {
            id: "protocolo_aceite",
            tipo: "Protocolo aceite pelo E.E.",
            descricao: "O Encarregado de Educação concordou com o protocolo.",
            data: now,
          },
          ...p.ocorrencias,
        ],
      }));
    } catch (err) {
      console.error("[EE concordar]", err);
    } finally {
      setConcordandoLoading(false);
    }
  };

  if (state.loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Sem permissão para aceder a este educando.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/encarregado"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mt-0.5">
          <Link href="/encarregado">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-foreground text-balance">{state.studentName}</h1>
        <p className="text-muted-foreground">{state.escola} &bull; {state.curso}</p>
        {state.estagioEstado && (
          <div className="mt-2">
            {state.estagioEstado === "Ativo" && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Estágio ativo
              </Badge>
            )}
            {state.estagioEstado === "Concluído" && (
              <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" /> Concluído</Badge>
            )}
            {state.estagioEstado === "Pendente" && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                <Clock className="mr-1 h-3 w-3" /> Pendente
              </Badge>
            )}
          </div>
        )}
      </div>

      {!state.estagioId ? (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Este educando ainda não tem estágio registado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Protocolo de Estágio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-muted-foreground" />
                Protocolo de Estágio
              </CardTitle>
              <CardDescription>Consulte e aceite o protocolo de estágio do seu educando.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.protocolFileUrl ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button asChild variant="outline" size="sm">
                      <a href={state.protocolFileUrl} target="_blank" rel="noreferrer">
                        <FileText className="mr-2 h-4 w-4" />
                        Visualizar protocolo
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={state.protocolFileUrl} download={state.protocolFileName || "protocolo.pdf"}>
                        <Download className="mr-2 h-4 w-4" />
                        Descarregar PDF
                      </a>
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      {state.encarregadoConcordou ? (
                        <div className="flex items-center gap-2 text-green-700">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm font-medium">Protocolo aceite</span>
                          {state.concordouAt && (
                            <span className="text-xs text-muted-foreground">em {state.concordouAt}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Ao clicar em <strong>Concordar com o protocolo</strong>, declara que tomou conhecimento e aceita os termos. Esta ação é irreversível.
                        </p>
                      )}
                    </div>

                    {!state.encarregadoConcordou && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" disabled={concordandoLoading}>
                            {concordandoLoading ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A processar...</>
                            ) : (
                              <><CheckCircle2 className="mr-2 h-4 w-4" />Concordar com o protocolo</>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar aceitação do protocolo</AlertDialogTitle>
                            <AlertDialogDescription>
                              Ao confirmar, declara que leu e aceita os termos do protocolo de estágio de <strong>{state.studentName}</strong>. Esta ação é irreversível e ficará registada com data e hora.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConcordar}>
                              Confirmar aceitação
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ainda não foi carregado nenhum protocolo para este estágio.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Relatórios e Sumários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Sumários e Relatórios
              </CardTitle>
              <CardDescription>
                {state.relatorios.length > 0
                  ? `${state.relatorios.length} documento(s) submetido(s)`
                  : "Ainda não foram submetidos sumários."}
              </CardDescription>
            </CardHeader>
            {state.relatorios.length > 0 && (
              <CardContent>
                <div className="space-y-3">
                  {state.relatorios.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.titulo}</p>
                        <p className="text-xs text-muted-foreground">{r.dataSubmissao}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RelatorioEstadoBadge estado={r.estado} />
                        {r.fileUrl && (
                          <Button asChild variant="ghost" size="sm">
                            <a href={r.fileUrl} target="_blank" rel="noreferrer">
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Descarregar</span>
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Ocorrências / Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                Ocorrências
              </CardTitle>
              <CardDescription>Registo cronológico de eventos importantes do estágio.</CardDescription>
            </CardHeader>
            <CardContent>
              {state.ocorrencias.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem ocorrências registadas.</p>
              ) : (
                <ol className="relative border-l border-border ml-3 space-y-4">
                  {state.ocorrencias.map((o) => (
                    <li key={o.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                      <time className="text-xs text-muted-foreground">{o.data}</time>
                      <p className="text-sm font-medium text-foreground">{o.tipo}</p>
                      <p className="text-xs text-muted-foreground">{o.descricao}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
