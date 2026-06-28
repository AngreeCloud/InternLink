"use client";

import { useEffect, useState } from "react";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SupportButton } from "@/components/chat/support-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Headset } from "lucide-react";

const HIDDEN_ROLES = ["super_admin", "support"];

export function ProfileSupportSection() {
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [userData, setUserData] = useState<{ uid: string; email: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const auth = await getAuthRuntime();
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        const db = await getDbRuntime();
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) { setLoading(false); return; }

        const data = snap.data() as { role?: string; nome?: string; email?: string };
        const role = data.role || "";

        if (!cancelled) {
          setShow(!HIDDEN_ROLES.includes(role));
          setUserData({ uid: user.uid, email: user.email || "", name: data.nome || "" });
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Skeleton className="h-32 rounded-lg" />;
  if (!show) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Headset className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Suporte Técnico</CardTitle>
        </div>
        <CardDescription>
          Precisa de ajuda? Abra um ticket e a nossa equipa de suporte entrará em contacto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SupportButton
          variant="outline"
          userId={userData?.uid}
          userName={userData?.name}
          userEmail={userData?.email}
        />
      </CardContent>
    </Card>
  );
}
