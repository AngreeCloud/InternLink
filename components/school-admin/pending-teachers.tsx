"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PendingTeacher = {
  id: string;
  name: string;
  email: string;
  createdAt: Date | null;
};

export function PendingTeachersSection({
  showSearch = true,
  limit,
  showActions = true,
  title = "Professores por aprovar",
  description = "Lista de professores pendentes na sua escola.",
}: {
  showSearch?: boolean;
  limit?: number;
  showActions?: boolean;
  title?: string;
  description?: string;
}) {
  const { schoolId, userId, name, email } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actingTeacherId, setActingTeacherId] = useState("");
  const [queryText, setQueryText] = useState("");

  const handleTeacherDecision = async (teacher: PendingTeacher, decision: "aprovado" | "recusado") => {
    setActionError("");
    setActionSuccess("");
    setActingTeacherId(teacher.id);

    try {
      const db = await getDbRuntime();
      const batch = writeBatch(db);

      const userRef = doc(db, "users", teacher.id);
      const pendingTeacherRef = doc(db, "schools", schoolId, "pendingTeachers", teacher.id);
      const historyRef = doc(collection(db, "schools", schoolId, "approvalHistory"));

      batch.update(userRef, {
        estado: decision === "aprovado" ? "ativo" : "recusado",
        reviewedAt: serverTimestamp(),
        reviewedBy: userId,
      });
      batch.delete(pendingTeacherRef);
      batch.set(historyRef, {
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        decision,
        decidedById: userId,
        decidedByName: name,
        decidedByEmail: email,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setTeachers((current) => current.filter((currentTeacher) => currentTeacher.id !== teacher.id));
      setActionSuccess(
        decision === "aprovado"
          ? "Professor aprovado com sucesso."
          : "Professor recusado e removido da lista de pendentes."
      );
    } catch (error) {
      console.error("Erro ao processar aprovação de professor:", error);
      setActionError("Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setActingTeacherId("");
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const db = await getDbRuntime();
        const pendingRef = collection(db, "schools", schoolId, "pendingTeachers");
        const pendingSnapshot = await getDocs(query(pendingRef, orderBy("createdAt", "desc")));

        const pendingTeachers = pendingSnapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as {
            name?: string;
            nome?: string;
            email?: string;
            createdAt?: { toDate?: () => Date };
          };

          return {
            id: docSnap.id,
            name: docData.name || docData.nome || "—",
            email: docData.email || "—",
            createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : null,
          };
        });

        const usersSnapshot = await getDocs(query(collection(db, "users"), where("schoolId", "==", schoolId)));
        const usersPendingTeachers = usersSnapshot.docs
          .map((docSnap) => {
            const docData = docSnap.data() as {
              role?: string;
              estado?: string;
              nome?: string;
              name?: string;
              email?: string;
              createdAt?: { toDate?: () => Date };
            };

            if (docData.role !== "professor" || docData.estado !== "pendente") {
              return null;
            }

            return {
              id: docSnap.id,
              name: docData.nome || docData.name || "—",
              email: docData.email || "—",
              createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : null,
            };
          })
          .filter((teacher): teacher is Exclude<typeof teacher, null> => teacher !== null);

        if (!active) return;

        const mergedById = new Map<string, PendingTeacher>();
        for (const teacher of [...pendingTeachers, ...usersPendingTeachers]) {
          mergedById.set(teacher.id, teacher);
        }

        const merged = [...mergedById.values()].sort((a, b) => {
          const aTime = a.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });

        setTeachers(merged);
      } catch (error) {
        console.error("Erro ao carregar professores pendentes:", error);
        if (!active) return;
        setTeachers([]);
        setLoadError("Não foi possível carregar os professores pendentes.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [schoolId]);

  const filteredTeachers = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const data = !q
      ? teachers
      : teachers.filter((teacher) =>
          `${teacher.name} ${teacher.email}`.toLowerCase().includes(q)
        );
    return typeof limit === "number" ? data.slice(0, limit) : data;
  }, [teachers, queryText, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {showSearch && (
          <div className="mb-4">
            <Input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Pesquisar por nome ou email"
            />
          </div>
        )}
        {actionError ? <p className="mb-3 text-sm text-destructive">{actionError}</p> : null}
        {actionSuccess ? <p className="mb-3 text-sm text-emerald-600">{actionSuccess}</p> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar professores...</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : filteredTeachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem professores pendentes.</p>
        ) : (
          <div className="space-y-3">
            {filteredTeachers.map((teacher) => (
              <div key={teacher.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-foreground">{teacher.name}</p>
                  <p className="text-xs text-muted-foreground">{teacher.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    {teacher.createdAt ? teacher.createdAt.toLocaleString() : "—"}
                  </p>
                  {showActions ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleTeacherDecision(teacher, "aprovado")}
                        disabled={actingTeacherId === teacher.id}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTeacherDecision(teacher, "recusado")}
                        disabled={actingTeacherId === teacher.id}
                      >
                        Recusar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
