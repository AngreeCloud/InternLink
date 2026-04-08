"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

type SchoolTutor = {
  id: string;
  nome: string;
  email: string;
  empresa: string;
  photoURL: string;
  approvedByProfessorName: string;
  joinedAt: string;
};

export function TutorSystemOverview() {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [tutors, setTutors] = useState<SchoolTutor[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const db = await getDbRuntime();
        const snapshot = await getDocs(collection(db, "schools", schoolId, "tutors"));
        if (!active) return;

        const list = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              nome?: string;
              email?: string;
              empresa?: string;
              photoURL?: string;
              approvedByProfessorName?: string;
              joinedAt?: { toDate: () => Date };
            };

            return {
              id: docSnap.id,
              nome: data.nome || "Tutor",
              email: data.email || "—",
              empresa: data.empresa || "—",
              photoURL: data.photoURL || "",
              approvedByProfessorName: data.approvedByProfessorName || "—",
              joinedAt: data.joinedAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));

        setTutors(list);
      } catch (error) {
        console.error("Erro ao carregar tutores do sistema de estágio:", error);
        setTutors([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [schoolId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Sistema de Estágios da Escola
        </CardTitle>
        <CardDescription>
          {loading ? "A carregar..." : `${tutors.length} tutor(es) associados ao sistema.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar tutores...</p>
        ) : tutors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não existem tutores associados ao sistema da escola.
          </p>
        ) : (
          <div className="space-y-3">
            {tutors.map((tutor) => (
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
                <div className="text-right text-xs text-muted-foreground">
                  <p>Convidado por: {tutor.approvedByProfessorName}</p>
                  <p>Entrada: {tutor.joinedAt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
