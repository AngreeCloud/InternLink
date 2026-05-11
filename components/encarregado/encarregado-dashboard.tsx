"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, AlertCircle, ChevronRight, GraduationCap } from "lucide-react";

type Educando = {
  id: string;
  nome: string;
  escola: string;
  curso: string;
  estagioEstado: "ativo" | "concluido" | "pendente" | "sem_estagio";
  protocoloAceite: boolean;
  estagioId: string | null;
};

const ESTADO_LABELS: Record<Educando["estagioEstado"], string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  pendente: "Pendente",
  sem_estagio: "Sem estágio",
};

const ACTIVE_STATES = new Set(["ativo", "em_curso", "em curso", "iniciado", "aberto"]);
const COMPLETED_STATES = new Set(["concluido", "concluído", "finalizado", "terminado", "encerrado"]);

function mapEstagioEstado(estado?: string): Educando["estagioEstado"] {
  const normalized = (estado || "").trim().toLowerCase();
  if (ACTIVE_STATES.has(normalized)) return "ativo";
  if (COMPLETED_STATES.has(normalized)) return "concluido";
  if (normalized === "pendente") return "pendente";
  return "pendente";
}

function EstadoBadge({ estado }: { estado: Educando["estagioEstado"] }) {
  if (estado === "ativo") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Ativo
      </Badge>
    );
  }
  if (estado === "concluido") {
    return (
      <Badge variant="secondary">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Concluído
      </Badge>
    );
  }
  if (estado === "pendente") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <Clock className="mr-1 h-3 w-3" />
        Pendente
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <AlertCircle className="mr-1 h-3 w-3" />
      Sem estágio
    </Badge>
  );
}

export function EncarregadoDashboard() {
  const [educandos, setEducandos] = useState<Educando[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) setLoading(false);
          return;
        }

        try {
          const eeSnap = await getDoc(doc(db, "users", user.uid));
          if (!eeSnap.exists() || !active) {
            setLoading(false);
            return;
          }

          const eeData = eeSnap.data() as { educandoIds?: string[] };
          const educandoIds: string[] = Array.isArray(eeData.educandoIds) ? eeData.educandoIds : [];

          if (educandoIds.length === 0) {
            setEducandos([]);
            setLoading(false);
            return;
          }

          const results: Educando[] = await Promise.all(
            educandoIds.map(async (studentId) => {
              const studentSnap = await getDoc(doc(db, "users", studentId));
              if (!studentSnap.exists()) {
                return null as unknown as Educando;
              }

              const studentData = studentSnap.data() as {
                nome?: string;
                escola?: string;
                curso?: string;
                schoolId?: string;
              };

              // Load school name
              let escolaNome = studentData.escola || "—";
              if (studentData.schoolId) {
                try {
                  const schoolSnap = await getDoc(doc(db, "schools", studentData.schoolId));
                  if (schoolSnap.exists()) {
                    const sd = schoolSnap.data() as { name?: string; shortName?: string };
                    escolaNome = sd.name || sd.shortName || escolaNome;
                  }
                } catch {
                  // ignore
                }
              }

              // Load estágio
              const estagiosSnap = await getDocs(
                query(collection(db, "estagios"), where("alunoId", "==", studentId))
              );

              let estagioEstado: Educando["estagioEstado"] = "sem_estagio";
              let estagioId: string | null = null;
              let protocoloAceite = false;

              const estagioDoc = estagiosSnap.docs[0];
              if (estagioDoc) {
                estagioId = estagioDoc.id;
                const ed = estagioDoc.data() as {
                  estadoEstagio?: string;
                  estado?: string;
                  encarregadoConcordou?: boolean;
                };
                estagioEstado = mapEstagioEstado(ed.estadoEstagio || ed.estado);
                protocoloAceite = ed.encarregadoConcordou === true;
              }

              return {
                id: studentId,
                nome: studentData.nome || "—",
                escola: escolaNome,
                curso: studentData.curso || "—",
                estagioEstado,
                protocoloAceite,
                estagioId,
              } satisfies Educando;
            })
          );

          if (!active) return;

          setEducandos(results.filter(Boolean));
        } catch (err) {
          console.error("[EE dashboard]", err);
        } finally {
          if (active) setLoading(false);
        }
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground text-balance">Dashboard</h1>
        <p className="text-muted-foreground">Acompanhe o estado do estágio dos seus educandos.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : educandos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm">Nenhum educando associado à sua conta.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {educandos.map((educando) => (
            <Link
              key={educando.id}
              href={`/encarregado/educando/${educando.id}`}
              className="group relative flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground truncate text-balance">
                    {educando.nome}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{educando.escola}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{educando.curso}</p>

              <div className="mt-auto flex flex-col gap-2">
                <EstadoBadge estado={educando.estagioEstado} />
                {educando.estagioId && (
                  <p className="text-xs text-muted-foreground">
                    Protocolo:{" "}
                    <span className={educando.protocoloAceite ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {educando.protocoloAceite ? "Aceite" : "Pendente de aceitação"}
                    </span>
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
