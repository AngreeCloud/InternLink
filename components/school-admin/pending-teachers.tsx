"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { ensureOrgMemberIndexByUserId } from "@/lib/chat/realtime-chat";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PendingTeacher = {
  id: string;
  name: string;
  email: string;
  createdAt: Date | null;
  hasUserDoc: boolean;
  source: "pendingTeacherDoc" | "userDoc" | "pendingRegistration";
};



export function PendingTeachersSection({
  showSearch = true,
  limit,
  showActions = false,
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
    if (!teacher.hasUserDoc) {
      setActionError("Este pedido ainda não tem perfil finalizado. O professor deve concluir o registo para poder ser aprovado.");
      return;
    }

    setActionError("");
    setActionSuccess("");
    setActingTeacherId(teacher.id);

    try {
      const db = await getDbRuntime();
      const batch = writeBatch(db);

      const userRef = doc(db, "users", teacher.id);
      const pendingTeacherRef = doc(db, "schools", schoolId, "pendingTeachers", teacher.id);
      const historyRef = doc(collection(db, "schools", schoolId, "approvalHistory"));

      // NOTE: The approvalHistory collection requires isSchoolAdminFor(schoolId) permission.
      // This component should only be rendered with showActions=true in school-admin contexts.
      // Firestore will deny the batch if the user lacks write permission on approvalHistory.
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

      if (decision === "aprovado") {
        try {
          await ensureOrgMemberIndexByUserId(teacher.id);
        } catch (syncError) {
          console.error("Falha ao sincronizar índice de chat do professor aprovado:", syncError);
        }
      }

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
            hasUserDoc: false,
            source: "pendingTeacherDoc" as const,
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
              photoURL?: string;
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
              hasUserDoc: true,
              source: "userDoc" as const,
            };
          })
          .filter((teacher): teacher is Exclude<typeof teacher, null> => teacher !== null);

        const pendingRegistrationsSnapshot = await getDocs(
          query(
            collection(db, "pendingRegistrations"),
            where("role", "==", "professor"),
            where("estado", "==", "pendente"),
            where("schoolId", "==", schoolId)
          )
        );

        const pendingRegistrationsTeachers = pendingRegistrationsSnapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as {
            nome?: string;
            email?: string;
            createdAt?: { toDate?: () => Date };
          };

          return {
            id: docSnap.id,
            name: docData.nome || "—",
            email: docData.email || "—",
            createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : null,
            hasUserDoc: false,
            source: "pendingRegistration" as const,
          } satisfies PendingTeacher;
        });

        if (!active) return;

        const usersById = new Set(usersPendingTeachers.map((teacher) => teacher.id));
        const mergedById = new Map<string, PendingTeacher>();

        for (const teacher of [...pendingTeachers, ...pendingRegistrationsTeachers, ...usersPendingTeachers]) {
          const nextTeacher = usersById.has(teacher.id)
            ? { ...teacher, hasUserDoc: true }
            : teacher;

          const existing = mergedById.get(teacher.id);
          if (!existing || (!existing.hasUserDoc && nextTeacher.hasUserDoc)) {
            mergedById.set(teacher.id, nextTeacher);
          }
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
                        disabled={actingTeacherId === teacher.id || !teacher.hasUserDoc}
                        title={!teacher.hasUserDoc ? "Aguardar finalização do registo do professor" : ""}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTeacherDecision(teacher, "recusado")}
                        disabled={actingTeacherId === teacher.id || !teacher.hasUserDoc}
                        title={!teacher.hasUserDoc ? "Aguardar finalização do registo do professor" : ""}
                      >
                        Recusar
                      </Button>
                    </div>
                  ) : null}
                </div>
                {!teacher.hasUserDoc && (
                  <p className="mt-1 text-xs text-amber-700">
                    Pedido recebido. A aprovação fica disponível após finalização do perfil do professor.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
