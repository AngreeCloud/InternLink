"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getDatabase, ref, onValue, push, set, serverTimestamp } from "firebase/database";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Send, Clock } from "lucide-react";

type Props = {
  role?: string;
};

type ChatMessage = {
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: number;
};

export function ProfileSupportSection({ role }: Props) {
  const [active, setActive] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [hasAgent, setHasAgent] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isHidden = !role || role === "super_admin" || role === "support";
  if (isHidden) return null;

  // Get current user
  useEffect(() => {
    (async () => {
      const auth = await getAuthRuntime();
      if (auth.currentUser) setUid(auth.currentUser.uid);
    })();
  }, []);

  // Subscribe to messages when conversationId is set
  useEffect(() => {
    if (!conversationId) return;
    const db = getDatabase();
    const msgsRef = ref(db, `messages/${conversationId}`);
    const unsub = onValue(msgsRef, (snap) => {
      if (!snap.exists()) { setMessages([]); return; }
      const all: ChatMessage[] = [];
      snap.forEach((child) => {
        const data = child.val() as ChatMessage;
        all.push(data);
      });
      all.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(all);
    });
    return () => unsub();
  }, [conversationId]);

  // Subscribe to conversation to detect agent
  useEffect(() => {
    if (!conversationId) return;
    const db = getDatabase();
    const convRef = ref(db, `conversations/${conversationId}`);
    const unsub = onValue(convRef, (snap) => {
      if (!snap.exists()) { setHasAgent(false); return; }
      const data = snap.val() as { participants?: Record<string, boolean> };
      const participants = data.participants || {};
      const otherIds = Object.keys(participants).filter((id) => id !== uid);
      setHasAgent(otherIds.length > 0);
    });
    return () => unsub();
  }, [conversationId, uid]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStart = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/support/chat", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; conversationId?: string };
      if (!res.ok || !data.conversationId) throw new Error("Falha ao criar chat.");
      setConversationId(data.conversationId);

      // Write conversation to RTDB
      const db = getDatabase();
      const ts = Date.now();
      await Promise.all([
        set(ref(db, `conversations/${data.conversationId}`), {
          type: "support",
          participants: { [uid!]: true },
          createdAt: ts,
          updatedAt: ts,
          lastMessage: { text: null, senderId: null, createdAt: ts, hasAttachments: false },
        }),
        set(ref(db, `userConversations/${uid}/${data.conversationId}`), {
          lastMessageText: null,
          lastMessageAt: ts,
          unreadCount: 0,
          isMuted: false,
        }),
      ]);

      setActive(true);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !conversationId || !uid) return;
    setSending(true);
    try {
      const db = getDatabase();
      const msgRef = ref(db, `messages/${conversationId}`);
      const newMsgRef = push(msgRef);
      const ts = Date.now();
      await set(newMsgRef, {
        senderId: uid,
        text: text.trim(),
        createdAt: ts,
        deleted: false,
      });
      await set(ref(db, `conversations/${conversationId}/lastMessage`), {
        text: text.trim(),
        senderId: uid,
        createdAt: ts,
        hasAttachments: false,
      });
      await set(ref(db, `conversations/${conversationId}/updatedAt`), ts);
      setText("");
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Suporte InternLink</CardTitle>
        </div>
        <CardDescription>
          {!active
            ? "Fale diretamente com a nossa equipa de suporte técnico."
            : hasAgent
              ? "Está a falar com um agente de suporte."
              : "Esperando agente do suporte — um membro da equipa entrará em breve."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {!active ? (
          <Button onClick={handleStart} disabled={creating} className="w-full">
            {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A criar...</> : <><MessageSquare className="mr-2 h-4 w-4" /> Abrir Chat de Suporte</>}
          </Button>
        ) : (
          <div className="flex flex-col" style={{ minHeight: 320 }}>
            {/* Messages area */}
            <div className="flex-1 space-y-2 mb-3 max-h-72 overflow-y-auto rounded-md border bg-muted/20 p-3">
              {messages.length === 0 && (
                <div className="flex items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <Clock className="mx-auto h-5 w-5" />
                  <span>Esperando agente do suporte...</span>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={[
                    "flex flex-col max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    msg.senderId === uid
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted",
                  ].join(" ")}
                >
                  <span className="whitespace-pre-wrap break-words">{msg.text}</span>
                  <span className="mt-0.5 text-[10px] opacity-60 text-right">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva a sua mensagem..."
                disabled={sending}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
