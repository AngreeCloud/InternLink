"use client";

import { useEffect, useState } from "react";
import { useChatNotifications } from "@/lib/chat/use-chat-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export function EncarregadoNotificacoes() {
  const [userId, setUserId] = useState("");
  const router = useRouter();

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid || "");
      });
    })();
    return () => unsubscribe();
  }, []);

  const { notifications } = useChatNotifications({
    userId,
    enabled: true,
    isChatOpen: false,
    onOpenConversation: (conversationId) => {
      router.push(`/encarregado/chat?conversationId=${conversationId}`);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Notificações</h1>
        <p className="text-muted-foreground">Alertas e mensagens relacionados com os seus educandos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Mensagens não lidas
            {notifications.length > 0 && (
              <Badge>{notifications.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Conversas com atividade recente.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem notificações por ler.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <button
                  key={n.conversationId}
                  className="w-full text-left flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
                  onClick={() => router.push(`/encarregado/chat?conversationId=${n.conversationId}`)}
                >
                  <MessageSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.preview}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
