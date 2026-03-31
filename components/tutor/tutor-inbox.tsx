"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, ChevronDown, ChevronUp, Inbox, Mail, MessageSquare, School } from "lucide-react";

type TutorInvite = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  schoolBannerUrl: string;
  schoolProfileImageUrl: string;
  schoolAddress: string;
  schoolContact: string;
  bannerFocusX: number;
  bannerFocusY: number;
  professorId: string;
  professorName: string;
  professorPhotoURL: string;
  email: string;
  estado: string;
  createdAtMillis: number;
  createdAt: string;
};

type AssociatedSchool = {
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  approvedByProfessorId: string;
  approvedByProfessorName: string;
  approvedByProfessorPhotoURL: string;
  joinedAt: string;
  bannerUrl: string;
  profileImageUrl: string;
  bannerFocusX: number;
  bannerFocusY: number;
  address: string;
  contact: string;
};

export function TutorInbox() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<TutorInvite[]>([]);
  const [associatedSchools, setAssociatedSchools] = useState<AssociatedSchool[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedSchoolId, setExpandedSchoolId] = useState("");

  const pendingInvites = useMemo(
    () => invites.filter((invite) => (invite.estado || "pendente") === "pendente"),
    [invites]
  );

  const loadData = async (userId: string) => {
    const db = await getDbRuntime();
    const auth = await getAuthRuntime();
    const user = auth.currentUser;
    if (!user || user.uid !== userId) {
      return;
    }

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userData = userSnap.exists() ? (userSnap.data() as { email?: string }) : {};
    const tokenEmailRaw = (user.email || "").trim();
    const tokenEmail = tokenEmailRaw.toLowerCase();
    const profileEmail = (userData.email || "").trim().toLowerCase();
    const resolvedEmail = tokenEmail || profileEmail;
    const normalizedEmail = resolvedEmail.toLowerCase();
    setEmail(resolvedEmail || user.email || userData.email || "");

    let inviteList: TutorInvite[] = [];
    try {
      const snapshots = await Promise.all([
        getDocs(query(collection(db, "tutorInvites"), where("email", "==", tokenEmailRaw))),
        getDocs(query(collection(db, "tutorInvites"), where("email", "==", resolvedEmail))),
        ...(normalizedEmail && normalizedEmail !== resolvedEmail
          ? [getDocs(query(collection(db, "tutorInvites"), where("email", "==", normalizedEmail)))]
          : []),
        getDocs(query(collection(db, "tutorInvites"), where("emailNormalized", "==", resolvedEmail))),
        ...(normalizedEmail && normalizedEmail !== resolvedEmail
          ? [getDocs(query(collection(db, "tutorInvites"), where("emailNormalized", "==", normalizedEmail)))]
          : []),
      ]);

      const inviteMap = new Map<string, TutorInvite>();

      for (const invitesSnap of snapshots) {
        for (const inviteDoc of invitesSnap.docs) {
          const data = inviteDoc.data() as {
            schoolId?: string;
            schoolName?: string;
            schoolShortName?: string;
            schoolBannerUrl?: string;
            schoolProfileImageUrl?: string;
            schoolAddress?: string;
            schoolContact?: string;
            professorId?: string;
            professorName?: string;
            professorPhotoURL?: string;
            email?: string;
            estado?: string;
            createdAt?: { toDate: () => Date };
          };

          let schoolBannerUrl = data.schoolBannerUrl || "";
          let schoolProfileImageUrl = data.schoolProfileImageUrl || "";
          let schoolAddress = data.schoolAddress || "";
          let schoolContact = data.schoolContact || "";
          let bannerFocusX = 50;
          let bannerFocusY = 50;

          if (data.schoolId && (!schoolBannerUrl || !schoolProfileImageUrl || !schoolAddress || !schoolContact)) {
            try {
              const schoolSnap = await getDoc(doc(db, "schools", data.schoolId));
              if (schoolSnap.exists()) {
                const schoolData = schoolSnap.data() as {
                  bannerUrl?: string;
                  profileImageUrl?: string;
                  bannerFocusX?: number;
                  bannerFocusY?: number;
                  address?: string;
                  contact?: string;
                };
                schoolBannerUrl = schoolBannerUrl || schoolData.bannerUrl || "";
                schoolProfileImageUrl = schoolProfileImageUrl || schoolData.profileImageUrl || "";
                schoolAddress = schoolAddress || schoolData.address || "";
                schoolContact = schoolContact || schoolData.contact || "";
                bannerFocusX = typeof schoolData.bannerFocusX === "number" ? schoolData.bannerFocusX : 50;
                bannerFocusY = typeof schoolData.bannerFocusY === "number" ? schoolData.bannerFocusY : 50;
              }
            } catch {
              // ignore
            }
          } else if (data.schoolId) {
            try {
              const schoolSnap = await getDoc(doc(db, "schools", data.schoolId));
              if (schoolSnap.exists()) {
                const schoolData = schoolSnap.data() as { bannerFocusX?: number; bannerFocusY?: number };
                bannerFocusX = typeof schoolData.bannerFocusX === "number" ? schoolData.bannerFocusX : 50;
                bannerFocusY = typeof schoolData.bannerFocusY === "number" ? schoolData.bannerFocusY : 50;
              }
            } catch {
              // ignore
            }
          }

          inviteMap.set(inviteDoc.id, {
            id: inviteDoc.id,
            schoolId: data.schoolId || "",
            schoolName: data.schoolName || "Escola",
            schoolShortName: data.schoolShortName || "",
            schoolBannerUrl,
            schoolProfileImageUrl,
            schoolAddress,
            schoolContact,
            bannerFocusX,
            bannerFocusY,
            professorId: data.professorId || "",
            professorName: data.professorName || "Professor",
            professorPhotoURL: data.professorPhotoURL || "",
            email: data.email || resolvedEmail,
            estado: data.estado || "pendente",
            createdAtMillis: data.createdAt?.toDate?.()?.getTime?.() ?? 0,
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          });
        }
      }

      inviteList = Array.from(inviteMap.values()).sort((a, b) => b.createdAtMillis - a.createdAtMillis);
      setInvites(inviteList);
    } catch {
      setInvites([]);
      inviteList = [];
    }

    try {
      const acceptedInvites = inviteList.filter(
        (invite) => invite.estado === "aceite" || invite.estado === "aceito"
      );

      const schoolsList = acceptedInvites.map((invite) => ({
        schoolId: invite.schoolId || "",
        schoolName: invite.schoolName || "Escola",
        schoolShortName: invite.schoolShortName || "",
        approvedByProfessorId: invite.professorId || "",
        approvedByProfessorName: invite.professorName || "Professor",
        approvedByProfessorPhotoURL: invite.professorPhotoURL || "",
        joinedAt: invite.createdAt || "—",
        bannerUrl: invite.schoolBannerUrl || "",
        profileImageUrl: invite.schoolProfileImageUrl || "",
        bannerFocusX: invite.bannerFocusX,
        bannerFocusY: invite.bannerFocusY,
        address: invite.schoolAddress || "",
        contact: invite.schoolContact || "",
      }));

      try {
        const byTutorId = await getDocs(query(collectionGroup(db, "tutors"), where("tutorId", "==", userId)));
        const tutorDocs = [...byTutorId.docs];
        for (const tutorDoc of tutorDocs) {
          const tutorData = tutorDoc.data() as {
            schoolId?: string;
            schoolName?: string;
            schoolShortName?: string;
            approvedByProfessorId?: string;
            approvedByProfessorName?: string;
            approvedByProfessorPhotoURL?: string;
            schoolBannerUrl?: string;
            schoolProfileImageUrl?: string;
            schoolAddress?: string;
            schoolContact?: string;
            joinedAt?: { toDate?: () => Date };
          };

          const schoolId = tutorData.schoolId || tutorDoc.ref.parent.parent?.id || "";
          if (!schoolId) continue;

          if (schoolsList.some((school) => school.schoolId === schoolId)) {
            continue;
          }

          let schoolName = tutorData.schoolName || "Escola";
          let schoolShortName = tutorData.schoolShortName || "";
          let bannerUrl = tutorData.schoolBannerUrl || "";
          let profileImageUrl = tutorData.schoolProfileImageUrl || "";
          let address = tutorData.schoolAddress || "";
          let contact = tutorData.schoolContact || "";
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
                address?: string;
                contact?: string;
              };
              schoolName = schoolData.name || schoolName;
              schoolShortName = schoolData.shortName || schoolShortName;
              bannerUrl = bannerUrl || schoolData.bannerUrl || "";
              profileImageUrl = profileImageUrl || schoolData.profileImageUrl || "";
              address = address || schoolData.address || "";
              contact = contact || schoolData.contact || "";
              bannerFocusX = typeof schoolData.bannerFocusX === "number" ? schoolData.bannerFocusX : 50;
              bannerFocusY = typeof schoolData.bannerFocusY === "number" ? schoolData.bannerFocusY : 50;
            }
          } catch {
            // ignore
          }

          schoolsList.push({
            schoolId,
            schoolName,
            schoolShortName,
            approvedByProfessorId: tutorData.approvedByProfessorId || "",
            approvedByProfessorName: tutorData.approvedByProfessorName || "Professor",
            approvedByProfessorPhotoURL: tutorData.approvedByProfessorPhotoURL || "",
            joinedAt: tutorData.joinedAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
            bannerUrl,
            profileImageUrl,
            bannerFocusX,
            bannerFocusY,
            address,
            contact,
          });
        }
      } catch {
        // ignore
      }

      const uniqueSchools = schoolsList
        .filter((item, index, self) => item.schoolId && self.findIndex((x) => x.schoolId === item.schoolId) === index)
        .sort((a, b) => (a.schoolShortName || a.schoolName).localeCompare(b.schoolShortName || b.schoolName, "pt-PT"));

      setAssociatedSchools(uniqueSchools);
      if (expandedSchoolId && !uniqueSchools.some((school) => school.schoolId === expandedSchoolId)) {
        setExpandedSchoolId("");
      }
    } catch {
      setAssociatedSchools([]);
      setExpandedSchoolId("");
    }

    setLoading(false);
  };

  const handleAcceptInvite = async (invite: TutorInvite) => {
    setActionLoading(invite.id);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists()
        ? (userSnap.data() as { nome?: string; email?: string; photoURL?: string; empresa?: string })
        : {};

      await updateDoc(doc(db, "tutorInvites", invite.id), {
        estado: "aceite",
        tutorId: user.uid,
        acceptedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "schools", invite.schoolId, "tutors", user.uid),
        {
          tutorId: user.uid,
          role: "tutor",
          schoolId: invite.schoolId,
          schoolName: invite.schoolName || "",
          schoolShortName: invite.schoolShortName || "",
          schoolBannerUrl: invite.schoolBannerUrl || "",
          schoolProfileImageUrl: invite.schoolProfileImageUrl || "",
          schoolAddress: invite.schoolAddress || "",
          schoolContact: invite.schoolContact || "",
          nome: userData.nome || user.displayName || "Tutor",
          email: userData.email || user.email || invite.email,
          photoURL: userData.photoURL || "",
          empresa: userData.empresa || "",
          approvedByProfessorId: invite.professorId,
          approvedByProfessorName: invite.professorName,
          approvedByProfessorPhotoURL: invite.professorPhotoURL,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await loadData(user.uid);
      router.push(`/tutor/chat?schoolId=${encodeURIComponent(invite.schoolId)}`);
    } catch (error) {
      console.error("Erro ao aceitar convite:", error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setLoading(false);
          setInvites([]);
          setAssociatedSchools([]);
          return;
        }

        await loadData(user.uid);
      });
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Caixa de Entrada</h1>
        <p className="text-muted-foreground">
          Convites de escolas, associação ao sistema e acesso rápido ao chat e estágios.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Convites Pendentes
          </CardTitle>
          <CardDescription>{pendingInvites.length} convite(s) pendente(s) para {email || "o seu email"}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar convites...</p>
          ) : pendingInvites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Inbox className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Sem convites pendentes de momento.
              </p>
            </div>
          ) : (
            pendingInvites.map((invite) => {
              const schoolLabel = invite.schoolShortName || invite.schoolName;
              return (
                <div key={invite.id} className="overflow-hidden rounded-lg border border-border">
                  {invite.schoolBannerUrl ? (
                    <div className="h-32 w-full bg-muted">
                      <img
                        src={invite.schoolBannerUrl}
                        alt={`Banner de ${invite.schoolName}`}
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${invite.bannerFocusX}% ${invite.bannerFocusY}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {invite.schoolProfileImageUrl ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={invite.schoolProfileImageUrl} alt={invite.schoolName} />
                              <AvatarFallback>{schoolLabel.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                            </div>
                          )}
                          <Badge variant="secondary">Pendente</Badge>
                          <span className="text-sm font-medium">{schoolLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={invite.professorPhotoURL || "/placeholder.svg"} alt={invite.professorName} />
                            <AvatarFallback>{invite.professorName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>Professor: {invite.professorName}</span>
                        </div>
                        {invite.schoolAddress || invite.schoolContact ? (
                          <p className="text-xs text-muted-foreground">
                            {[invite.schoolAddress, invite.schoolContact].filter(Boolean).join(" • ")}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">Convite enviado em: {invite.createdAt}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAcceptInvite(invite)}
                        disabled={actionLoading === invite.id}
                      >
                        {actionLoading === invite.id ? "A aceitar..." : "Aceitar e abrir chat"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-4 w-4" />
            Escolas Associadas
          </CardTitle>
          <CardDescription>
            {associatedSchools.length} escola(s) associada(s). Clique para expandir e ver a mini página da escola.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar escolas...</p>
          ) : associatedSchools.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não está associado ao sistema de nenhuma escola.</p>
          ) : (
            associatedSchools.map((school) => {
              const schoolLabel = school.schoolShortName || school.schoolName;
              const expanded = expandedSchoolId === school.schoolId;
              return (
                <div key={school.schoolId} className="overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setExpandedSchoolId(expanded ? "" : school.schoolId)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40"
                  >
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
                      <div>
                        <p className="text-sm font-medium">{schoolLabel}</p>
                        <p className="text-xs text-muted-foreground">Entrada: {school.joinedAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {expanded ? "Ocultar" : "Ver detalhes"}
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border bg-card">
                      {school.bannerUrl ? (
                        <div className="h-40 w-full bg-muted">
                          <img
                            src={school.bannerUrl}
                            alt={`Banner de ${school.schoolName}`}
                            className="h-full w-full object-cover"
                            style={{ objectPosition: `${school.bannerFocusX}% ${school.bannerFocusY}%` }}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-3 p-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Associado</Badge>
                          <span className="text-sm text-muted-foreground">Professor responsável: {school.approvedByProfessorName}</span>
                        </div>
                        <p className="text-sm text-foreground">{school.schoolName}</p>
                        {(school.address || school.contact) && (
                          <p className="text-sm text-muted-foreground">
                            {[school.address, school.contact].filter(Boolean).join(" • ")}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/tutor/chat?schoolId=${encodeURIComponent(school.schoolId)}`)}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Abrir chat
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => router.push(`/tutor/estagios?schoolId=${encodeURIComponent(school.schoolId)}`)}
                          >
                            Ver estágios
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {associatedSchools.length > 0 ? (
        <Card>
          <CardContent className="py-4 text-sm text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Associação ativa: já pode falar com professores e acompanhar estágios por escola.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
