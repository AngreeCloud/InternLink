"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Course = {
  id: string;
  name: string;
  year?: number | null;
  maxStudents?: number | null;
  enrolledCount?: number | null;
};

export function CoursesOverview({ limit = 4 }: { limit?: number }) {
  const { schoolId } = useSchoolAdmin();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const db = await getDbRuntime();
      const snapshot = await getDocs(
        query(collection(db, "courses"), where("schoolId", "==", schoolId), orderBy("createdAt", "desc"))
      );

      if (!active) return;

      setCourses(
        snapshot.docs.slice(0, limit).map((docSnap) => {
          const data = docSnap.data() as { name?: string; year?: number; maxStudents?: number; enrolledCount?: number };
          return {
            id: docSnap.id,
            name: data.name || "—",
            year: data.year ?? null,
            maxStudents: data.maxStudents ?? null,
            enrolledCount: data.enrolledCount ?? 0,
          };
        })
      );
    };

    load();

    return () => {
      active = false;
    };
  }, [schoolId, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cursos recentes</CardTitle>
        <CardDescription>Alguns cursos criados recentemente.</CardDescription>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não existem cursos.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => (
              <div key={course.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="text-base font-semibold text-foreground">{course.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {course.year != null && <Badge variant="secondary">Ano: {course.year}</Badge>}
                  <Badge variant="secondary">Limite: {course.maxStudents ?? "—"}</Badge>
                  <Badge variant="outline">Inscritos: {course.enrolledCount ?? 0}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
