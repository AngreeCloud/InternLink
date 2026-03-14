"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  collectionGroup,
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
import { Building2, CheckCircle2, Inbox, Mail, MessageSquare, School } from "lucide-react";

type TutorInvite = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  professorId: string;
  professorName: string;
  professorPhotoURL: string;
  email: string;
  estado: string;
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
    const resolvedEmail = userData.email || user.email || "";
    setEmail(resolvedEmail);

    try {
      const invitesSnap = await getDocs(
        query(collection(db, "tutorInvites"), where("email", "==", resolvedEmail))
      );

      const inviteList: TutorInvite[] = invitesSnap.docs
        .map((inviteDoc) => {
          const data = inviteDoc.data() as {
            schoolId?: string;
            schoolName?: string;
            schoolShortName?: string;
            professorId?: string;
            professorName?: string;
            professorPhotoURL?: string;
            email?: string;
            estado?: string;
            createdAt?: { toDate: () => Date };
          };

          return {
            id: inviteDoc.id,
            schoolId: data.schoolId || "",
            schoolName: data.schoolName || "Escola",
            schoolShortName: data.schoolShortName || "",
            professorId: data.professorId || "",
            professorName: data.professorName || "Professor",
            professorPhotoURL: data.professorPhotoURL || "",
            email: data.email || resolvedEmail,
            estado: data.estado || "pendente",
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setInvites(inviteList);
    } catch {
      setInvites([]);
    }

    try {
      const schoolsSnap = await getDocs(
        query(collectionGroup(db, "tutors"), where("tutorId", "==", user.uid))
      );

      const schoolsList = await Promise.all(
        schoolsSnap.docs.map(async (schoolTutorDoc) => {
          const data = schoolTutorDoc.data() as {
            schoolId?: string;
            schoolName?: string;
            schoolShortName?: string;
            approvedByProfessorId?: string;
            approvedByProfessorName?: string;
            approvedByProfessorPhotoURL?: string;
            joinedAt?: { toDate: () => Date };
          };

          const schoolId = data.schoolId || "";
          let bannerUrl = "";
          let profileImageUrl = "";
          let address = "";
          let contact = "";

          if (schoolId) {
            const schoolSnap = await getDoc(doc(db, "schools", schoolId));
            if (schoolSnap.exists()) {
              const schoolData = schoolSnap.data() as {
                bannerUrl?: string;
                profileImageUrl?: string;
                address?: string;
                contact?: string;
              };
              bannerUrl = schoolData.bannerUrl || "";
              profileImageUrl = schoolData.profileImageUrl || "";
              address = schoolData.address || "";
              contact = schoolData.contact || "";
            }
          }

          return {
            schoolId,
            schoolName: data.schoolName || "Escola",
            schoolShortName: data.schoolShortName || "",
            approvedByProfessorId: data.approvedByProfessorId || "",
            approvedByProfessorName: data.approvedByProfessorName || "Professor",
            approvedByProfessorPhotoURL: data.approvedByProfessorPhotoURL || "",
            joinedAt: data.joinedAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
            bannerUrl,
            profileImageUrl,
            address,
            contact,
          } as AssociatedSchool;
        })
      );

      const uniqueSchools = schoolsList.filter(
        (item, index, self) => item.schoolId && self.findIndex((x) => x.schoolId === item.schoolId) === index
      );

      setAssociatedSchools(uniqueSchools);
    } catch {
      setAssociatedSchools([]);
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
        tutorNome: userData.nome || user.displayName || "Tutor",
        tutorEmail: userData.email || user.email || invite.email,
        tutorPhotoURL: userData.photoURL || "",
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
          Sempre disponível: aceite convites de escolas e abra chat com os professores que o convidaram.
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
                <div key={invite.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
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
            {associatedSchools.length} escola(s) associada(s). Pode estar associado a várias escolas e estágios em paralelo.
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
              return (
                <div key={school.schoolId} className="overflow-hidden rounded-lg border border-border">
                  {school.bannerUrl ? (
                    <div className="h-24 w-full bg-muted">
                      <img src={school.bannerUrl} alt={`Banner de ${school.schoolName}`} className="h-full w-full object-cover" />
                    </div>
                  ) : null}

                  <div className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {school.profileImageUrl ? (
                            <img
                              src={school.profileImageUrl}
                              alt={`Imagem de ${school.schoolName}`}
                              className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                            </div>
                          )}
                          <p className="text-sm font-medium">{schoolLabel}</p>
                          <Badge variant="default">Associado</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Professor responsável: {school.approvedByProfessorName} • Entrada: {school.joinedAt}
                        </p>
                        {school.address || school.contact ? (
                          <p className="text-xs text-muted-foreground">
                            {[school.address, school.contact].filter(Boolean).join(" • ")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/tutor/chat?schoolId=${encodeURIComponent(school.schoolId)}`)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Abrir chat
                      </Button>
                    </div>
                  </div>
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
              Chat desbloqueado: já pode falar com professores das escolas associadas.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
