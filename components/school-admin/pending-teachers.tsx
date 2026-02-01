"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type PendingTeacher = {
  id: string;
  name: string;
  email: string;
  createdAt?: Date | null;
};

export function PendingTeachersSection() {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Professores por aprovar</CardTitle>
        <CardDescription>Lista de professores pendentes na sua escola.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar professores...</p>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem professores pendentes.</p>
        ) : (
          <div className="space-y-3">
            {teachers.map((teacher) => (
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
