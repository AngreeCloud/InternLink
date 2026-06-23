"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

type SchoolTutor = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
  empresa: string;
  approvedByProfessorName: string;
  joinedAt: string;
};

type TutorInvite = {
  id: string;
  nome: string;
  email: string;
  estado: string;
  professorId: string;
  professorName: string;
  createdAt: string;
  createdAtMs: number;
};

type AuthState = {
  userId: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  schoolBannerUrl: string;
  schoolProfileImageUrl: string;
  schoolAddress: string;
  schoolContact: string;
  professorName: string;
  professorPhotoURL: string;
};

export function TutoresManager() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [schoolTutors, setSchoolTutors] = useState<SchoolTutor[]>([]);
  const [tutorInvites, setTutorInvites] = useState<TutorInvite[]>([]);
  const [showAllInvites, setShowAllInvites] = useState(false);

  const [inviteSearch, setInviteSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");

  const [tutorDialogOpen, setTutorDialogOpen] = useState(false);
  const [inviteTutorEmail, setInviteTutorEmail] = useState("");
  const [inviteTutorName, setInviteTutorName] = useState("");
  const [inviting, setInviting] = useState(false);

  const [removingInviteId, setRemovingInviteId] = useState<string | null>(null);
  const [removingSchoolTutorId, setRemovingSchoolTutorId] = useState<string | null>(null);
  const [confirmRemoveTutor, setConfirmRemoveTutor] = useState<SchoolTutor | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const authInst = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = authInst.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as {
        schoolId?: string;
        nome?: string;
        photoURL?: string;
      };
      if (!userData.schoolId) return;

      const schoolSnap = await getDoc(doc(db, "schools", userData.schoolId));
      let schoolName = "";
      let schoolShortName = "";
      let schoolBannerUrl = "";
      let schoolProfileImageUrl = "";
      let schoolAddress = "";
      let schoolContact = "";
      if (schoolSnap.exists()) {
        const sData = schoolSnap.data() as {
          name?: string; shortName?: string; bannerUrl?: string;
          profileImageUrl?: string; address?: string; contact?: string;
        };
        schoolName = sData.name || "";
        schoolShortName = sData.shortName || "";
        schoolBannerUrl = sData.bannerUrl || "";
        schoolProfileImageUrl = sData.profileImageUrl || "";
        schoolAddress = sData.address || "";
        schoolContact = sData.contact || "";
      }

      setAuth({
        userId: user.uid,
        schoolId: userData.schoolId,
        schoolName,
        schoolShortName,
        schoolBannerUrl,
        schoolProfileImageUrl,
        schoolAddress,
        schoolContact,
        professorName: userData.nome || user.displayName || "Professor",
        professorPhotoURL: userData.photoURL || "",
      });

      const loadInvites = async () => {
        try {
          const baseQuery = query(
            collection(db, "tutorInvites"),
            where("schoolId", "==", userData.schoolId)
          );
          const snap = await getDocs(baseQuery);
          const list: TutorInvite[] = snap.docs
            .map((d) => {
              const data = d.data() as {
                nome?: string; email?: string; estado?: string;
                professorId?: string; professorName?: string;
                createdAt?: { toDate: () => Date };
              };
              const createdAtDate = data.createdAt?.toDate?.() || null;
              return {
                id: d.id,
                nome: data.nome || "Tutor",
                email: data.email || "—",
                estado: data.estado || "pendente",
                professorId: data.professorId || "",
                professorName: data.professorName || "—",
                createdAt: createdAtDate?.toLocaleDateString("pt-PT") || "—",
                createdAtMs: createdAtDate?.getTime() || 0,
              };
            })
            .sort((a, b) => b.createdAtMs - a.createdAtMs);
          setTutorInvites(list);
        } catch (e) {
          console.error("Erro ao carregar convites:", e);
        }
      };

      await loadInvites();

      try {
        const tutorsSnap = await getDocs(collection(db, "schools", userData.schoolId, "tutors"));
        const list: SchoolTutor[] = tutorsSnap.docs
          .map((d) => {
            const data = d.data() as {
              nome?: string; email?: string; photoURL?: string;
              empresa?: string; approvedByProfessorName?: string;
              joinedAt?: { toDate: () => Date };
            };
            return {
              id: d.id,
              nome: data.nome || "Tutor",
              email: data.email || "—",
              photoURL: data.photoURL || "",
              empresa: data.empresa || "—",
              approvedByProfessorName: data.approvedByProfessorName || "—",
              joinedAt: data.joinedAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));
        setSchoolTutors(list);
      } catch (e) {
        console.error("Erro ao carregar tutores:", e);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const a = await getAuthRuntime();
      unsub = onAuthStateChanged(a, () => { loadData(); });
    })();
    return () => unsub();
  }, []);

  const filteredInvites = useMemo(() => {
    const invites = showAllInvites
      ? tutorInvites
      : tutorInvites.filter((inv) => inv.estado === "pendente" && inv.professorId === auth?.userId);
    const term = inviteSearch.trim().toLowerCase();
    if (!term) return invites;
    return invites.filter(
      (inv) =>
        inv.nome.toLowerCase().includes(term) ||
        inv.email.toLowerCase().includes(term)
    );
  }, [tutorInvites, showAllInvites, inviteSearch, auth?.userId]);

  const filteredTutors = useMemo(() => {
    const term = tutorSearch.trim().toLowerCase();
    if (!term) return schoolTutors;
    return schoolTutors.filter(
      (t) =>
        t.nome.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        t.empresa.toLowerCase().includes(term)
    );
  }, [schoolTutors, tutorSearch]);

  const pendingInvitesAll = tutorInvites.filter((inv) => inv.estado === "pendente");
  const myPendingInvites = pendingInvitesAll.filter((inv) => inv.professorId === auth?.userId);
  const otherPendingInvites = pendingInvitesAll.filter((inv) => inv.professorId !== auth?.userId);

  const handleInviteTutor = async () => {
    if (!inviteTutorEmail.trim() || !auth) return;
    setInviting(true);
    try {
      const db = await getDbRuntime();
      const normalizedEmail = inviteTutorEmail.trim().toLowerCase();
      const defaultName = normalizedEmail.split("@")[0] || "Tutor";
      await addDoc(collection(db, "tutorInvites"), {
        email: normalizedEmail,
        emailNormalized: normalizedEmail,
        nome: inviteTutorName.trim() || defaultName,
        schoolId: auth.schoolId,
        schoolName: auth.schoolName,
        schoolShortName: auth.schoolShortName,
        schoolBannerUrl: auth.schoolBannerUrl,
        schoolProfileImageUrl: auth.schoolProfileImageUrl,
        schoolAddress: auth.schoolAddress,
        schoolContact: auth.schoolContact,
        professorId: auth.userId,
        professorName: auth.professorName,
        professorPhotoURL: auth.professorPhotoURL,
        estado: "pendente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setInviteTutorEmail("");
      setInviteTutorName("");
      setTutorDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Erro ao convidar tutor:", error);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    setRemovingInviteId(inviteId);
    try {
      const db = await getDbRuntime();
      await deleteDoc(doc(db, "tutorInvites", inviteId));
      setTutorInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (error) {
      console.error("Erro ao remover convite:", error);
    } finally {
      setRemovingInviteId(null);
    }
  };

  const handleRemoveSchoolTutor = async (tutorId: string) => {
    if (!auth) return;
    setRemovingSchoolTutorId(tutorId);
    try {
      const db = await getDbRuntime();
      await deleteDoc(doc(db, "schools", auth.schoolId, "tutors", tutorId));
      setSchoolTutors((prev) => prev.filter((t) => t.id !== tutorId));
    } catch (error) {
      console.error("Erro ao remover tutor:", error);
    } finally {
      setRemovingSchoolTutorId(null);
    }
  };

  const schoolLabel = auth?.schoolShortName || auth?.schoolName || "Escola";
  const ownCount = myPendingInvites.length;
  const otherCount = otherPendingInvites.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tutores</h1>
          <p className="text-muted-foreground">
            Convide tutores de empresa e gerir tutores associados a {schoolLabel}.
          </p>
        </div>
        <Dialog open={tutorDialogOpen} onOpenChange={setTutorDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Tutor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Tutor para {schoolLabel}</DialogTitle>
              <DialogDescription>
                O tutor será convidado para o sistema de estágio da escola. Pode ser associado a um estágio depois.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tutorInviteName">Nome do Tutor (opcional)</Label>
                <Input
                  id="tutorInviteName"
                  placeholder="Nome completo"
                  value={inviteTutorName}
                  onChange={(e) => setInviteTutorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tutorInviteEmail">Email do Tutor</Label>
                <Input
                  id="tutorInviteEmail"
                  type="email"
                  placeholder="tutor@empresa.com"
                  value={inviteTutorEmail}
                  onChange={(e) => setInviteTutorEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleInviteTutor} disabled={inviting} className="w-full">
                {inviting ? "A convidar..." : "Enviar Convite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convites Pendentes
          </CardTitle>
          <CardDescription>
            {ownCount} convite(s) seu(s) pendente(s)
            {otherCount > 0 ? ` ∙ ${otherCount} de outro(s) professor(es)` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou email..."
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showAllInvites
                ? "Não existem convites pendentes na escola."
                : "Não tem convites pendentes."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{invite.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{invite.nome}</p>
                      <p className="text-xs text-muted-foreground">{invite.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="secondary">pendente</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Por: {invite.professorName} • {invite.createdAt}
                      </p>
                    </div>
                    {invite.professorId === auth?.userId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveInvite(invite.id)}
                        disabled={removingInviteId === invite.id}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {removingInviteId === invite.id ? "A remover..." : "Remover"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showAllInvites && otherCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllInvites(true)}
            >
              <ChevronDown className="mr-2 h-4 w-4" />
              Ver mais ({otherCount} de outro(s) professor(es))
            </Button>
          )}
          {showAllInvites && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllInvites(false)}
            >
              <ChevronUp className="mr-2 h-4 w-4" />
              Mostrar apenas os meus
            </Button>
          )}
        </CardContent>
      </Card>

      {/* School Tutors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tutores da Escola
          </CardTitle>
          <CardDescription>
            Tutores já associados ao sistema da escola ({schoolTutors.length}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email ou empresa..."
              value={tutorSearch}
              onChange={(e) => setTutorSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredTutors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {schoolTutors.length === 0
                ? "Ainda não existem tutores associados ao sistema. Use 'Convidar Tutor' para começar."
                : "Nenhum tutor corresponde à pesquisa."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredTutors.map((tutor) => (
                <div key={tutor.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={tutor.photoURL || undefined} alt={tutor.nome} />
                      <AvatarFallback>{tutor.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{tutor.nome}</p>
                      <p className="text-xs text-muted-foreground">{tutor.email} • {tutor.empresa}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Convidado por: {tutor.approvedByProfessorName}</p>
                      <p>Entrada: {tutor.joinedAt}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmRemoveTutor(tutor)}
                    >
                      <DoorOpen className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Remove Tutor Dialog */}
      <Dialog open={Boolean(confirmRemoveTutor)} onOpenChange={(open) => !open && setConfirmRemoveTutor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover tutor do sistema da escola?</DialogTitle>
            <DialogDescription>
              Esta ação remove <strong>{confirmRemoveTutor?.nome || "o tutor"}</strong> do sistema da escola.
              <br /><br />
              Aviso: pode impactar associações futuras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmRemoveTutor || removingSchoolTutorId === confirmRemoveTutor.id}
              onClick={async () => {
                if (!confirmRemoveTutor) return;
                await handleRemoveSchoolTutor(confirmRemoveTutor.id);
                setConfirmRemoveTutor(null);
              }}
            >
              {confirmRemoveTutor && removingSchoolTutorId === confirmRemoveTutor.id ? "A remover..." : "Confirmar remoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
