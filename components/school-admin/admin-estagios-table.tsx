"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Firestore, collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, Loader2, Briefcase } from "lucide-react";

type EstagioRow = {
  id: string;
  titulo: string;
  alunoNome: string;
  alunoEmail: string;
  professorNome: string;
  professorId?: string;
  tutorNome: string;
  tutorId?: string;
  empresa: string;
  courseNome: string;
  courseId?: string;
  estado: string;
  dataInicio: string;
  dataFimEstimada: string;
};

export function AdminEstagiosTable() {
  const { schoolId } = useSchoolAdmin();
  const [estagios, setEstagios] = useState<EstagioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const db = await getDbRuntime();
        const snap = await getDocs(
          query(collection(db, "estagios"), where("schoolId", "==", schoolId))
        );
        if (cancelled) return;
        let list: (EstagioRow & { professorId?: string; tutorId?: string; courseId?: string })[] =
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              titulo: (data.titulo as string) || "—",
              alunoNome: (data.alunoNome as string) || "—",
              alunoEmail: (data.alunoEmail as string) || "",
              professorNome: (data.professorNome as string) || "",
              professorId: (data.professorId as string) || undefined,
              tutorNome: (data.tutorNome as string) || "",
              tutorId: (data.tutorId as string) || undefined,
              empresa: (data.entidadeAcolhimento as string) || (data.empresa as string) || "—",
              courseNome: (data.courseNome as string) || (data.courseName as string) || "",
              courseId: (data.courseId as string) || (data.alunoCourseId as string) || undefined,
              estado: (data.estado as string) || "ativo",
              dataInicio: (data.dataInicio as string) || "",
              dataFimEstimada:
                (data.dataFimEstimada as string) || (data.dataFim as string) || "",
            };
          })
          .filter((e) => e.estado !== "eliminado");

        // Resolve nomes em falta a partir das coleções respetivas
        const missingProfessors: { professorId: string }[] = [];
        const missingTutors: { tutorId: string }[] = [];
        const missingCourses: { courseId: string }[] = [];
        for (const e of list) {
          if (!e.professorNome && e.professorId) missingProfessors.push({ professorId: e.professorId });
          if (!e.tutorNome && e.tutorId) missingTutors.push({ tutorId: e.tutorId });
          if (!e.courseNome && e.courseId) missingCourses.push({ courseId: e.courseId });
        }

        const [profMap, tutorMap, courseMap] = await Promise.all([
          resolveProfessorNames(db, missingProfessors),
          resolveTutorNames(db, schoolId, missingTutors),
          resolveCourseNames(db, missingCourses),
        ]);

        list = list.map((e) => ({
          ...e,
          professorNome:
            e.professorNome ||
            (e.professorId && profMap.get(e.professorId)) ||
            "—",
          tutorNome:
            e.tutorNome ||
            (e.tutorId && tutorMap.get(e.tutorId)) ||
            "",
          courseNome:
            e.courseNome ||
            (e.courseId && courseMap.get(e.courseId)) ||
            "—",
        }));

        list.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome, "pt-PT"));
        setEstagios(list);
      } catch (err) {
        console.error("Erro ao carregar estágios:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return estagios;
    return estagios.filter((e) =>
      [e.titulo, e.alunoNome, e.alunoEmail, e.professorNome, e.tutorNome, e.empresa, e.courseNome]
        .filter(Boolean)
        .map((v) => v.toLowerCase())
        .some((v) => v.includes(term))
    );
  }, [estagios, search]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar estágios...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar estágios..."
          className="pl-9"
        />
      </div>

      {estagios.length === 0 ? (
        <div className="py-8 text-center">
          <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">Nenhum estágio</h3>
          <p className="text-muted-foreground">Ainda não existem estágios na escola.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Professor</th>
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.alunoNome}</div>
                    {e.alunoEmail && (
                      <div className="text-xs text-muted-foreground">{e.alunoEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.titulo}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.professorNome}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.tutorNome || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.empresa}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.courseNome}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={e.estado === "ativo" ? "default" : "secondary"}>
                      {e.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {e.dataInicio || "—"}
                    {e.dataFimEstimada ? ` → ${e.dataFimEstimada}` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/school-admin/estagios/${e.id}`}>
                        Abrir
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} de {estagios.length} estágio(s)
          </div>
        </div>
      )}
    </div>
  );
}

async function resolveProfessorNames(
  db: Firestore,
  rows: { professorId: string }[]
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.professorId))];
  const map = new Map<string, string>();
  await Promise.all(
    ids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const d = snap.data() as { nome?: string; displayName?: string };
          map.set(uid, d.nome || d.displayName || uid);
        }
      } catch {
        // ignore
      }
    })
  );
  return map;
}

async function resolveTutorNames(
  db: Firestore,
  schoolId: string,
  rows: { tutorId: string }[]
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.tutorId))];
  const map = new Map<string, string>();
  await Promise.all(
    ids.map(async (tutorId) => {
      try {
        const snap = await getDoc(
          doc(db, "schools", schoolId, "tutors", tutorId)
        );
        if (snap.exists()) {
          const d = snap.data() as { nome?: string; email?: string };
          map.set(tutorId, d.nome || d.email || tutorId);
        }
      } catch {
        // ignore
      }
    })
  );
  return map;
}

async function resolveCourseNames(
  db: Firestore,
  rows: { courseId: string }[]
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.courseId))];
  const map = new Map<string, string>();
  await Promise.all(
    ids.map(async (courseId) => {
      try {
        const snap = await getDoc(doc(db, "courses", courseId));
        if (snap.exists()) {
          const d = snap.data() as { nome?: string; name?: string };
          map.set(courseId, d.nome || d.name || courseId);
        }
      } catch {
        // ignore
      }
    })
  );
  return map;
}
