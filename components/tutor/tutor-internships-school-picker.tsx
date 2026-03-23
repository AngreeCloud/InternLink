"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronRight, School } from "lucide-react";

type SchoolOption = {
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  bannerUrl: string;
  profileImageUrl: string;
  bannerFocusX: number;
  bannerFocusY: number;
  estagiosCount: number;
};

export function TutorInternshipsSchoolPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSchoolId = searchParams.get("schoolId") || "";

  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolOption[]>([]);

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => (a.schoolShortName || a.schoolName).localeCompare(b.schoolShortName || b.schoolName, "pt-PT")),
    [schools]
  );

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setSchools([]);
          setLoading(false);
          return;
        }

        let estagiosDocs: Array<{ schoolId?: string }> = [];
        try {
          const byTutorId = await getDocs(query(collection(db, "estagios"), where("tutorId", "==", user.uid)));

          const merged = new Map<string, { schoolId?: string }>();
          const estagioDocs = [...byTutorId.docs];
          for (const docSnap of estagioDocs) {
            merged.set(docSnap.id, docSnap.data() as { schoolId?: string });
          }
          estagiosDocs = Array.from(merged.values());
        } catch {
          estagiosDocs = [];
        }

        const counts = new Map<string, number>();
        for (const estagio of estagiosDocs) {
          const schoolId = estagio.schoolId || "";
          if (!schoolId) continue;
          counts.set(schoolId, (counts.get(schoolId) || 0) + 1);
        }

        try {
          const byTutorId = await getDocs(query(collectionGroup(db, "tutors"), where("tutorId", "==", user.uid)));
          const tutorDocs = [...byTutorId.docs];
          for (const tutorDoc of tutorDocs) {
            const tutorData = tutorDoc.data() as { schoolId?: string };
            const schoolId = tutorData.schoolId || tutorDoc.ref.parent.parent?.id || "";
            if (!schoolId) continue;
            if (!counts.has(schoolId)) {
              counts.set(schoolId, 0);
            }
          }
        } catch {
          // ignore
        }

        const options = await Promise.all(
          Array.from(counts.entries()).map(async ([schoolId, estagiosCount]) => {
            let schoolName = "Escola";
            let schoolShortName = "";
            let bannerUrl = "";
            let profileImageUrl = "";
            let bannerFocusX = 50;
            let bannerFocusY = 50;

            try {
              const schoolSnap = await getDoc(doc(db, "schools", schoolId));
              if (schoolSnap.exists()) {
                const schoolData = schoolSnap.data() as {
                  name?: string;
                  shortName?: string;
                  bannerUrl?: string;
                  profileImageUrl?: string;
                  bannerFocusX?: number;
                  bannerFocusY?: number;
                };
                schoolName = schoolData.name || schoolName;
                schoolShortName = schoolData.shortName || schoolShortName;
                bannerUrl = schoolData.bannerUrl || "";
                profileImageUrl = schoolData.profileImageUrl || "";
                bannerFocusX = typeof schoolData.bannerFocusX === "number" ? schoolData.bannerFocusX : 50;
                bannerFocusY = typeof schoolData.bannerFocusY === "number" ? schoolData.bannerFocusY : 50;
              }
            } catch {
              // ignore
            }

            return {
              schoolId,
              schoolName,
              schoolShortName,
              bannerUrl,
              profileImageUrl,
              bannerFocusX,
              bannerFocusY,
              estagiosCount,
            };
          })
        );

        setSchools(options);
        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Estágios</h1>
        <p className="text-muted-foreground">Escolha a escola para ver os estágios dos alunos pelos quais está encarregado(a).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-4 w-4" />
            Escolher escola
          </CardTitle>
          <CardDescription>O conteúdo é separado por escola para facilitar o acompanhamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar escolas...</p>
          ) : sortedSchools.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem estágios associados neste momento.</p>
          ) : (
            <div className="space-y-4">
              {sortedSchools.map((school) => {
                const schoolLabel = school.schoolShortName || school.schoolName;
                const isPreselected = preselectedSchoolId === school.schoolId;
                return (
                  <div key={school.schoolId} className="overflow-hidden rounded-lg border border-border">
                    {school.bannerUrl ? (
                      <div className="h-28 w-full bg-muted">
                        <img
                          src={school.bannerUrl}
                          alt={`Banner de ${school.schoolName}`}
                          className="h-full w-full object-cover"
                          style={{ objectPosition: `${school.bannerFocusX}% ${school.bannerFocusY}%` }}
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {school.profileImageUrl ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={school.profileImageUrl} alt={school.schoolName} />
                              <AvatarFallback>{schoolLabel.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                            </div>
                          )}
                          <p className="text-sm font-medium">{schoolLabel}</p>
                          <Badge variant="secondary">{school.estagiosCount} estágio(s)</Badge>
                          {isPreselected ? <Badge variant="default">Selecionada</Badge> : null}
                        </div>
                      </div>
                      <Button type="button" onClick={() => router.push(`/tutor/estagios/${school.schoolId}`)}>
                        Entrar
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
