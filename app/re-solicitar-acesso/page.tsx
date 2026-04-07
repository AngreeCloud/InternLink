"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import type { School } from "@/lib/types/school";
import { SchoolSelector } from "@/components/auth/school-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ReRequestSchoolAccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [profile, setProfile] = useState({
    userId: "",
    name: "",
    email: "",
    role: "",
    status: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedSchoolName = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId)?.name || "",
    [schools, selectedSchoolId]
  );

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        const userData = userSnap.data() as {
          role?: string;
          estado?: string;
          nome?: string;
          email?: string;
          schoolId?: string;
        };

        if (userData.role !== "professor") {
          setLoading(false);
          router.replace("/account-status");
          return;
        }

        const schoolsSnap = await getDocs(collection(db, "schools"));
        const list = schoolsSnap.docs.map((schoolDoc) => {
          const data = schoolDoc.data() as {
            name?: string;
            profileImageUrl?: string;
            emailDomain?: string;
            requireInstitutionalEmail?: boolean;
            allowGoogleLogin?: boolean;
            requiresPhone?: boolean;
          };

          return {
            id: schoolDoc.id,
            name: data.name || "—",
            profileImageUrl: data.profileImageUrl || "",
            emailDomain: data.emailDomain || "",
            requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
            allowGoogleLogin: Boolean(data.allowGoogleLogin),
            requiresPhone: Boolean(data.requiresPhone),
          } satisfies School;
        });

        setSchools(list);
        setSelectedSchoolId(userData.schoolId || "");
        setProfile({
          userId: user.uid,
          name: userData.nome || user.displayName || "Professor",
          email: userData.email || user.email || "",
          role: userData.role || "",
          status: userData.estado || "",
        });
        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async () => {
    if (!selectedSchoolId) {
      setSubmitError("Selecione uma escola.");
      return;
    }

    if (!profile.userId) {
      setSubmitError("Utilizador inválido.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const db = await getDbRuntime();

      await updateDoc(doc(db, "users", profile.userId), {
        schoolId: selectedSchoolId,
        estado: "pendente",
        courseId: null,
        reviewedAt: null,
        reviewedBy: null,
      });

      await setDoc(
        doc(db, "schools", selectedSchoolId, "pendingTeachers", profile.userId),
        {
          name: profile.name,
          email: profile.email,
          role: "teacher",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSubmitted(true);
    } catch (error) {
      console.error("Erro ao re-solicitar acesso à escola:", error);
      setSubmitError("Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <p>A carregar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Re-solicitar acesso à escola</CardTitle>
          <CardDescription>
            Escolha a escola e envie novo pedido de acesso. Os dados da sua conta serão mantidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <Alert>
              <AlertDescription>
                Pedido enviado para {selectedSchoolName || "a escola selecionada"}. Aguarde aprovação da direção.
              </AlertDescription>
            </Alert>
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <SchoolSelector
            schools={schools}
            value={selectedSchoolId}
            onChange={setSelectedSchoolId}
            label="Escola"
            placeholder="Pesquise a escola"
          />

          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/account-status">Voltar</Link>
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || submitted}>
              {submitting ? "A enviar..." : "Enviar pedido"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
