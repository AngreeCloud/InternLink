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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";

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

  return (
    <div className="flex flex-col -mt-10 -mb-10 -mx-4 sm:-mx-6 lg:-mx-8 h-[calc(100svh-4rem)]">
      <div className="flex flex-1 overflow-hidden">
        {/* Thread sidebar */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-card">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Conversas</p>
            <p className="text-xs text-muted-foreground">
              {loading ? "A carregar..." : `${threads.length} ativa(s)`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">A carregar...</p>
            ) : threads.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Sem conversas ativas.
              </p>
            ) : (
              <div className="p-2 space-y-1">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={[
                      "w-full rounded-lg p-3 text-left transition-colors",
                      selectedThreadId === thread.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={thread.tutorPhotoURL || "/placeholder.svg"} alt={thread.tutorNome} />
                        <AvatarFallback className="text-xs">{thread.tutorNome.charAt(0)}</AvatarFallback>
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
              </div>
            )}
          </div>
        </div>

        {/* Message panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              A carregar...
            </div>
          ) : !selectedThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {threads.length === 0
                  ? "Nenhum tutor aceitou convite ainda."
                  : "Selecione uma conversa."}
              </p>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedThread.tutorPhotoURL || "/placeholder.svg"} alt={selectedThread.tutorNome} />
                    <AvatarFallback>{selectedThread.tutorNome.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{selectedThread.tutorNome}</p>
                    <p className="text-xs text-muted-foreground">{selectedThread.tutorEmail}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                      message.sender === "professor"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    <p>{message.text}</p>
                    <p className="mt-0.5 text-[11px] opacity-60">{message.timestamp}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t border-border bg-card p-3">
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
