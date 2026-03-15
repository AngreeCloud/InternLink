"use client";

import { useEffect, useState } from "react";
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Building2, FileText, School } from "lucide-react";

type SchoolSummary = {
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  bannerUrl: string;
  profileImageUrl: string;
  bannerFocusX: number;
  bannerFocusY: number;
  address: string;
  contact: string;
  joinedAt: string;
};

type OverviewData = {
  loading: boolean;
  tutorName: string;
  empresa: string;
  estagios: number;
  documentos: number;
  associatedSchools: number;
  schools: SchoolSummary[];
};

export function TutorDashboardOverview() {
  const [state, setState] = useState<OverviewData>({
    loading: true,
    tutorName: "",
    empresa: "",
    estagios: 0,
    documentos: 0,
    associatedSchools: 0,
    schools: [],
  });

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists()
          ? (userSnap.data() as { nome?: string; empresa?: string; email?: string })
          : {};

        const resolvedEmail = (userData.email || user.email || "").trim();
        const normalizedEmail = resolvedEmail.toLowerCase();

        let estagios = 0;
        let documentos = 0;
        let schools: SchoolSummary[] = [];
        const estagioSchoolIds = new Set<string>();

        try {
          const byTutorId = await getDocs(query(collection(db, "estagios"), where("tutorId", "==", user.uid)));
          const byTutorEmail = resolvedEmail
            ? await getDocs(query(collection(db, "estagios"), where("tutorEmail", "==", resolvedEmail)))
            : null;
          const byTutorEmailNormalized = normalizedEmail && normalizedEmail !== resolvedEmail
            ? await getDocs(query(collection(db, "estagios"), where("tutorEmail", "==", normalizedEmail)))
            : null;

          const estagioMap = new Map<string, string>();
          const estagioDocs = [
            ...byTutorId.docs,
            ...(byTutorEmail?.docs || []),
            ...(byTutorEmailNormalized?.docs || []),
          ];
          for (const docSnap of estagioDocs) {
            estagioMap.set(docSnap.id, docSnap.id);
            const estagioData = docSnap.data() as { schoolId?: string };
            if (estagioData.schoolId) {
              estagioSchoolIds.add(estagioData.schoolId);
            }
          }
          const estagioIds = Array.from(estagioMap.keys());
          estagios = estagioIds.length;

          for (const estagioId of estagioIds) {
            try {
              const docsSnap = await getDocs(query(collection(db, "documentos"), where("estagioId", "==", estagioId)));
              documentos += docsSnap.size;
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }

        try {
          const byTutorId = await getDocs(query(collectionGroup(db, "tutors"), where("tutorId", "==", user.uid)));
          const byTutorEmail = resolvedEmail
            ? await getDocs(query(collectionGroup(db, "tutors"), where("email", "==", resolvedEmail)))
            : null;
          const byTutorEmailNormalized = normalizedEmail && normalizedEmail !== resolvedEmail
            ? await getDocs(query(collectionGroup(db, "tutors"), where("email", "==", normalizedEmail)))
            : null;

          const schoolsSnapDocs = [
            ...byTutorId.docs,
            ...(byTutorEmail?.docs || []),
            ...(byTutorEmailNormalized?.docs || []),
          ];

          const mapped = await Promise.all(
            schoolsSnapDocs.map(async (schoolTutorDoc) => {
              const data = schoolTutorDoc.data() as {
                schoolId?: string;
                schoolName?: string;
                schoolShortName?: string;
                joinedAt?: { toDate?: () => Date };
              };
              const schoolId = data.schoolId || schoolTutorDoc.ref.parent.parent?.id || "";
              let schoolName = data.schoolName || "Escola";
              let schoolShortName = data.schoolShortName || "";
              let bannerUrl = "";
              let profileImageUrl = "";
              let bannerFocusX = 50;
              let bannerFocusY = 50;
              let address = "";
              let contact = "";

              if (schoolId) {
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
                      address?: string;
                      contact?: string;
                    };
                    schoolName = schoolData.name || schoolName;
                    schoolShortName = schoolData.shortName || schoolShortName;
                    bannerUrl = schoolData.bannerUrl || "";
                    profileImageUrl = schoolData.profileImageUrl || "";
                    bannerFocusX = typeof schoolData.bannerFocusX === "number" ? schoolData.bannerFocusX : 50;
                    bannerFocusY = typeof schoolData.bannerFocusY === "number" ? schoolData.bannerFocusY : 50;
                    address = schoolData.address || "";
                    contact = schoolData.contact || "";
                  }
                } catch {
                  // ignore
                }
              }

              return {
                schoolId,
                schoolName,
                schoolShortName,
                bannerUrl,
                profileImageUrl,
                bannerFocusX,
                bannerFocusY,
                address,
                contact,
                joinedAt: data.joinedAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
              } as SchoolSummary;
            })
          );

          schools = mapped
            .filter((item, index, self) => item.schoolId && self.findIndex((x) => x.schoolId === item.schoolId) === index)
            .sort((a, b) => (a.schoolShortName || a.schoolName).localeCompare(b.schoolShortName || b.schoolName, "pt-PT"));
        } catch {
          schools = [];
        }

        if (schools.length === 0 && estagioSchoolIds.size > 0) {
          try {
            const fallbackSchools = await Promise.all(
              Array.from(estagioSchoolIds).map(async (schoolId) => {
                let schoolName = "Escola";
                let schoolShortName = "";
                let bannerUrl = "";
                let profileImageUrl = "";
                let bannerFocusX = 50;
                let bannerFocusY = 50;
                let address = "";
                let contact = "";

                const schoolSnap = await getDoc(doc(db, "schools", schoolId));
                if (schoolSnap.exists()) {
                  const schoolData = schoolSnap.data() as {
                    name?: string;
                    shortName?: string;
                    bannerUrl?: string;
                    profileImageUrl?: string;
                    bannerFocusX?: number;
                    bannerFocusY?: number;
                    address?: string;
                    contact?: string;
                  };
                  schoolName = schoolData.name || schoolName;
                  schoolShortName = schoolData.shortName || schoolShortName;
                  bannerUrl = schoolData.bannerUrl || "";
                  profileImageUrl = schoolData.profileImageUrl || "";
                  bannerFocusX = typeof schoolData.bannerFocusX === "number" ? schoolData.bannerFocusX : 50;
                  bannerFocusY = typeof schoolData.bannerFocusY === "number" ? schoolData.bannerFocusY : 50;
                  address = schoolData.address || "";
                  contact = schoolData.contact || "";
                }

                return {
                  schoolId,
                  schoolName,
                  schoolShortName,
                  bannerUrl,
                  profileImageUrl,
                  bannerFocusX,
                  bannerFocusY,
                  address,
                  contact,
                  joinedAt: "—",
                } as SchoolSummary;
              })
            );

            schools = fallbackSchools
              .filter((item) => item.schoolId)
              .sort((a, b) => (a.schoolShortName || a.schoolName).localeCompare(b.schoolShortName || b.schoolName, "pt-PT"));
          } catch {
            // ignore
          }
        }

        setState({
          loading: false,
          tutorName: userData.nome || user.displayName || "Tutor",
          empresa: userData.empresa || "—",
          estagios,
          documentos,
          associatedSchools: schools.length,
          schools,
        });
      });
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard do Tutor</h1>
        <p className="text-muted-foreground">
          A caixa de entrada está sempre disponível para novos convites e os estágios podem ser geridos por escola.
        </p>
      </div>

      {state.loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">A carregar dados...</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{state.tutorName}</CardTitle>
              <CardDescription>{state.empresa}</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Escolas Associadas</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.associatedSchools}</p>
                <p className="text-xs text-muted-foreground">Pode estar associado a várias escolas.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estágios Associados</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.estagios}</p>
                <p className="text-xs text-muted-foreground">Estágios em que está encarregado(a).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documentos</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.documentos}</p>
                <Badge variant={state.associatedSchools > 0 ? "default" : "secondary"}>
                  {state.associatedSchools > 0 ? "Chat desbloqueado" : "Aguardando associação"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Escolas associadas</CardTitle>
              <CardDescription>
                Cartões de informação da escola disponíveis assim que a associação é aprovada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state.schools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não está associado ao sistema de nenhuma escola.</p>
              ) : (
                <div className="space-y-4">
                  {state.schools.map((school) => {
                    const schoolLabel = school.schoolShortName || school.schoolName;
                    return (
                      <div key={school.schoolId} className="overflow-hidden rounded-lg border border-border">
                        {school.bannerUrl ? (
                          <div className="h-32 w-full bg-muted">
                            <img
                              src={school.bannerUrl}
                              alt={`Banner de ${school.schoolName}`}
                              className="h-full w-full object-cover"
                              style={{ objectPosition: `${school.bannerFocusX}% ${school.bannerFocusY}%` }}
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
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
                              <Badge variant="default">Associado</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Entrada no sistema: {school.joinedAt}</p>
                            {(school.address || school.contact) && (
                              <p className="text-xs text-muted-foreground">
                                {[school.address, school.contact].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
