"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, User } from "lucide-react";

type ChatThread = {
  id: string;
  tutorId: string;
  tutorNome: string;
  tutorEmail: string;
  tutorPhotoURL: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
};

type ChatMessage = {
  id: string;
  sender: "system" | "professor";
  text: string;
  timestamp: string;
};

export function ProfessorChatHub() {
  const searchParams = useSearchParams();
  const tutorIdFromUrl = searchParams.get("tutorId") || "";
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const selectedMessages = selectedThread ? messagesByThread[selectedThread.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedMessages]);

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setThreads([]);
          setLoading(false);
          return;
        }

        let acceptedInvites: Array<{
          tutorId?: string;
          tutorNome?: string;
          tutorEmail?: string;
          tutorPhotoURL?: string;
          schoolId?: string;
          schoolName?: string;
          schoolShortName?: string;
        }> = [];

        try {
          const invitesSnap = await getDocs(
            query(
              collection(db, "tutorInvites"),
              where("professorId", "==", user.uid)
            )
          );

          acceptedInvites = invitesSnap.docs
            .map((d) => d.data() as typeof acceptedInvites[0] & { estado?: string })
            .filter((d) => d.estado === "aceite" || d.estado === "aceito");
        } catch {
          setThreads([]);
          setLoading(false);
          return;
        }

        const list: ChatThread[] = await Promise.all(
          acceptedInvites.map(async (data) => {
            const schoolId = data.schoolId || "";
            let schoolName = data.schoolName || "Escola";
            let schoolShortName = data.schoolShortName || "";

            if (schoolId) {
              try {
                const schoolSnap = await getDoc(doc(db, "schools", schoolId));
                if (schoolSnap.exists()) {
                  const schoolData = schoolSnap.data() as { name?: string; shortName?: string };
                  schoolName = schoolData.name || schoolName;
                  schoolShortName = schoolData.shortName || schoolShortName;
                }
              } catch {
                // ignore
              }
            }

            const tutorId = data.tutorId || "";
            return {
              id: `${schoolId}-${tutorId || data.tutorEmail || "tutor"}`,
              tutorId,
              tutorNome: data.tutorNome || "Tutor",
              tutorEmail: data.tutorEmail || "",
              tutorPhotoURL: data.tutorPhotoURL || "",
              schoolId,
              schoolName,
              schoolShortName,
            };
          })
        );

        const validThreads = list.filter((item) => item.schoolId);
        setThreads(validThreads);

        const seededMessages: Record<string, ChatMessage[]> = {};
        for (const thread of validThreads) {
          seededMessages[thread.id] = [
            {
              id: `${thread.id}-1`,
              sender: "system",
              text: `Conversa desbloqueada com ${thread.tutorNome} após a sua associação ao sistema da escola.`,
              timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
            },
          ];
        }
        setMessagesByThread(seededMessages);

        const preselected = validThreads.find((item) => item.tutorId === tutorIdFromUrl);
        if (preselected) {
          setSelectedThreadId(preselected.id);
        } else if (validThreads[0]) {
          setSelectedThreadId(validThreads[0].id);
        }

        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, [tutorIdFromUrl]);

  const handleSend = () => {
    if (!selectedThread || !draft.trim()) return;

    const nextMessage: ChatMessage = {
      id: `${selectedThread.id}-${Date.now()}`,
      sender: "professor",
      text: draft.trim(),
      timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessagesByThread((prev) => ({
      ...prev,
      [selectedThread.id]: [...(prev[selectedThread.id] || []), nextMessage],
    }));
    setDraft("");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">A carregar chat...</CardContent>
      </Card>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chat com Tutores</h1>
          <p className="text-muted-foreground">
            O chat fica disponível após um tutor aceitar o seu convite.
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum tutor aceitou convite ainda.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Chat com Tutores</h1>
        <p className="text-muted-foreground">
          Conversas desbloqueadas com tutores que aceitaram o seu convite.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversas Ativas</CardTitle>
            <CardDescription>{threads.length} tutor(es)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={[
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  selectedThreadId === thread.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={thread.tutorPhotoURL || "/placeholder.svg"} alt={thread.tutorNome} />
                    <AvatarFallback>{thread.tutorNome.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{thread.tutorNome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.schoolShortName || thread.schoolName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex min-h-[460px] flex-col">
          {selectedThread ? (
            <>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  {selectedThread.tutorNome}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {selectedThread.tutorEmail}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-3 overflow-y-auto py-4">
                {selectedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.sender === "professor"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    <p>{message.text}</p>
                    <p className="mt-1 text-[11px] opacity-70">{message.timestamp}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </CardContent>

              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Escreva a sua mensagem..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleSend} disabled={!draft.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Badge variant="outline" className="mt-2 text-xs">
                  Pré-chat ativo
                </Badge>
              </div>
            </>
          ) : (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Selecione uma conversa.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
