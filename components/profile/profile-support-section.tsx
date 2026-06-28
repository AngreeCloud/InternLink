"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare } from "lucide-react";

const CHAT_ROUTES: Record<string, string> = {
  aluno: "/dashboard/chat",
  professor: "/professor/chat",
  tutor: "/tutor/chat",
  admin_escolar: "/school-admin/chat",
  encarregado: "/encarregado/chat",
};

type Props = {
  role?: string;
};

export function ProfileSupportSection({ role }: Props) {
  const [opening, setOpening] = useState(false);
  const router = useRouter();

  const isHidden = !role || role === "super_admin" || role === "support";
  if (isHidden) return null;

  const handleOpenSupport = async () => {
    setOpening(true);
    try {
      await fetch("/api/support/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Pedido de suporte via chat" }),
      });
    } catch { /* ignore */ }

    const route = CHAT_ROUTES[role] || "/dashboard/chat";
    router.push(route);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Suporte InternLink</CardTitle>
        </div>
        <CardDescription>
          Fale diretamente com a nossa equipa de suporte técnico. Um ticket será criado automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleOpenSupport} disabled={opening} className="w-full">
          {opening ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A abrir...</> : <><MessageSquare className="mr-2 h-4 w-4" /> Abrir Chat de Suporte</>}
        </Button>
      </CardContent>
    </Card>
  );
}
