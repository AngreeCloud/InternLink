"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, School } from "lucide-react";

type ChatThread = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  professorId: string;
  professorName: string;
  professorPhotoURL: string;
};

type ChatMessage = {
  id: string;
  sender: "system" | "tutor";
  text: string;
  timestamp: string;
};

export function TutorChatHub() {
  const searchParams = useSearchParams();
  const schoolIdFromUrl = searchParams.get("schoolId") || "";
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

        const associationsSnap = await getDocs(
          query(collectionGroup(db, "tutors"), where("tutorId", "==", user.uid))
        );

        const list: ChatThread[] = await Promise.all(
          associationsSnap.docs.map(async (associationDoc) => {
            const data = associationDoc.data() as {
              schoolId?: string;
              schoolName?: string;
              schoolShortName?: string;
              approvedByProfessorId?: string;
              approvedByProfessorName?: string;
              approvedByProfessorPhotoURL?: string;
            };

            const schoolId = data.schoolId || "";
            let schoolName = data.schoolName || "Escola";
            let schoolShortName = data.schoolShortName || "";

            if (schoolId) {
              const schoolSnap = await getDoc(doc(db, "schools", schoolId));
              if (schoolSnap.exists()) {
                const schoolData = schoolSnap.data() as { name?: string; shortName?: string };
                schoolName = schoolData.name || schoolName;
                schoolShortName = schoolData.shortName || schoolShortName;
              }
            }

            return {
              id: `${schoolId}-${data.approvedByProfessorId || "professor"}`,
              schoolId,
              schoolName,
              schoolShortName,
              professorId: data.approvedByProfessorId || "",
              professorName: data.approvedByProfessorName || "Professor",
              professorPhotoURL: data.approvedByProfessorPhotoURL || "",
            };
          })
        );

        const validThreads = list.filter((item) => item.schoolId);
        setThreads(validThreads);

        const seededMessages: Record<string, ChatMessage[]> = {};
        for (const thread of validThreads) {
          const schoolLabel = thread.schoolShortName || thread.schoolName;
          seededMessages[thread.id] = [
            {
              id: `${thread.id}-1`,
              sender: "system",
              text: `Conversa pré-aberta com ${thread.professorName} (${schoolLabel}).`,
              timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
            },
            {
              id: `${thread.id}-2`,
              sender: "system",
              text: "Este chat foi desbloqueado após a sua associação ao sistema da escola.",
              timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
            },
          ];
        }
        setMessagesByThread(seededMessages);

        const preselected = validThreads.find((item) => item.schoolId === schoolIdFromUrl);
        if (preselected) {
          setSelectedThreadId(preselected.id);
        } else if (validThreads[0]) {
          setSelectedThreadId(validThreads[0].id);
        }

        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, [schoolIdFromUrl]);

  const handleSend = () => {
    if (!selectedThread || !draft.trim()) return;

    const nextMessage: ChatMessage = {
      id: `${selectedThread.id}-${Date.now()}`,
      sender: "tutor",
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
          <h1 className="text-3xl font-bold text-foreground">Chat</h1>
          <p className="text-muted-foreground">O chat fica disponível após associação ao sistema de pelo menos uma escola.</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma associação ativa ao sistema escolar.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Chat</h1>
        <p className="text-muted-foreground">
          Conversas desbloqueadas com professores que o convidaram, independentemente da associação a estágio específico.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversas Abertas</CardTitle>
            <CardDescription>{threads.length} conversa(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {threads.map((thread) => {
              const schoolLabel = thread.schoolShortName || thread.schoolName;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={[
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selectedThreadId === thread.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={thread.professorPhotoURL || "/placeholder.svg"} alt={thread.professorName} />
                      <AvatarFallback>{thread.professorName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{thread.professorName}</p>
                      <p className="text-xs text-muted-foreground">{schoolLabel}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="flex min-h-[460px] flex-col">
          {selectedThread ? (
            <>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  {selectedThread.professorName}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <School className="h-4 w-4" />
                  {selectedThread.schoolShortName || selectedThread.schoolName}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-3 overflow-y-auto py-4">
                {selectedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.sender === "tutor"
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
