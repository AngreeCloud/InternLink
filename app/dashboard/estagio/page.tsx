"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2 } from "lucide-react";

/**
 * Página de entrada "Estágio" na sidebar do aluno.
 * Resolve automaticamente o estágio do aluno e redireciona para o detalhe.
 */
export default function StudentEstagioEntryPage() {
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; found: boolean }>({
    loading: true,
    found: false,
  });

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      const auth = await getAuthRuntime();
      unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        try {
          const db = await getDbRuntime();
          const snap = await getDocs(
            query(collection(db, "estagios"), where("alunoId", "==", user.uid))
          );
          if (cancelled) return;
          const doc = snap.docs[0];
          if (doc) {
            router.replace(`/dashboard/estagio/${doc.id}`);
            return;
          }
          setState({ loading: false, found: false });
        } catch (err) {
          console.error("[v0] student estagio entry failed", err);
          setState({ loading: false, found: false });
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [router]);

  return (
    <DashboardLayout>
      {state.loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A procurar o seu estágio...
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <Briefcase className="mt-1 h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle>Ainda não tem estágio ativo</CardTitle>
              <CardDescription>
                O Diretor de Curso ainda não abriu um estágio associado à sua conta.
                Assim que for criado, esta página redireciona automaticamente para
                o detalhe do estágio.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard">Voltar ao dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
