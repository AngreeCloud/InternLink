"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PendingTeacher = {
  id: string;
  name: string;
  email: string;
  createdAt?: Date | null;
};

export function PendingTeachersSection({
  showSearch = true,
  limit,
  title = "Professores por aprovar",
  description = "Lista de professores pendentes na sua escola.",
}: {
  showSearch?: boolean;
  limit?: number;
  title?: string;
  description?: string;
}) {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const db = await getDbRuntime();
      const pendingRef = collection(db, "schools", schoolId, "pendingTeachers");
      const snapshot = await getDocs(query(pendingRef, orderBy("createdAt", "desc")));

      if (!active) return;

      const data = snapshot.docs.map((docSnap) => {
        const docData = docSnap.data() as {
          name?: string;
          email?: string;
          createdAt?: { toDate?: () => Date };
        };

        return {
          id: docSnap.id,
          name: docData.name || "—",
          email: docData.email || "—",
          createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : null,
        };
      });

      setTeachers(data);
      setLoading(false);
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
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar professores...</p>
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
                <p className="text-xs text-muted-foreground">
                  {teacher.createdAt ? teacher.createdAt.toLocaleString() : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
