"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EstagioDetailView } from "@/components/estagios/estagio-detail-view";
import { Loader2 } from "lucide-react";

export default function StudentEstagioDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        setUserId(user.uid);
        setLoading(false);
      });
    })();
    return () => unsubscribe();
  }, [router]);

  const estagioId = typeof params?.id === "string" ? params.id : "";

  return (
    <DashboardLayout>
      {loading || !userId ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />A carregar estágio...
        </div>
      ) : (
        <EstagioDetailView
          estagioId={estagioId}
          currentUserId={userId}
          currentUserRole="aluno"
          backHref="/dashboard"
          backLabel="Voltar ao painel"
        />
      )}
    </DashboardLayout>
  );
}
