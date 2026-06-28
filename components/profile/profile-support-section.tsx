"use client";

import { useEffect, useRef, useState } from "react";
import { getDatabase, ref, onValue, push, set } from "firebase/database";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Clock, MessageSquare } from "lucide-react";

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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [hasAgent, setHasAgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isHidden = !role || role === "super_admin" || role === "support";
  if (isHidden) return null;

  useEffect(() => {
    (async () => {
      const auth = await getAuthRuntime();
      if (auth.currentUser) setUid(auth.currentUser.uid);
    })();
  }, []);

  // Subscribe to messages
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
    if (!conversationId || !uid) return;
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !uid) return;
    setSending(true);
    setError(null);

    try {
      // Create conversation on first message
      if (!conversationId) {
        setCreating(true);
        const res = await fetch("/api/support/chat", { method: "POST" });
        const data = (await res.json()) as { ok?: boolean; conversationId?: string; autoReply?: string; error?: string };
        if (!res.ok || !data.conversationId) throw new Error(data.error || "Falha ao criar chat.");
        setConversationId(data.conversationId);
        setCreating(false);

        // Send user's first message
        const db = getDatabase();
        const convId = data.conversationId;
        const msgRef = ref(db, `messages/${convId}`);
        const newMsgRef = push(msgRef);
        const userTs = Date.now();
        await set(newMsgRef, {
          senderId: uid,
          text: text.trim(),
          createdAt: userTs,
          deleted: false,
        });
        await Promise.all([
          set(ref(db, `conversations/${convId}/lastMessage`), {
            text: text.trim(),
            senderId: uid,
            createdAt: userTs,
            hasAttachments: false,
          }),
          set(ref(db, `conversations/${convId}/updatedAt`), userTs),
        ]);

        // Send auto-reply AFTER user's message
        if (data.autoReply) {
          const autoRef = push(msgRef);
          const autoTs = Date.now();
          await set(autoRef, {
            senderId: "__support__",
            senderName: "Suporte InternLink",
            text: data.autoReply,
            createdAt: autoTs,
            deleted: false,
          });
          await set(ref(db, `conversations/${convId}/lastMessage`), {
            text: data.autoReply,
            senderId: "__support__",
            createdAt: autoTs,
            hasAttachments: false,
          });
          await set(ref(db, `conversations/${convId}/updatedAt`), autoTs);
        }

        setText("");
        setSending(false);
        return;
      }

      // Send subsequent messages
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
      await Promise.all([
        set(ref(db, `conversations/${conversationId}/lastMessage`), {
          text: text.trim(),
          senderId: uid,
          createdAt: ts,
          hasAttachments: false,
        }),
        set(ref(db, `conversations/${conversationId}/updatedAt`), ts),
      ]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
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
    <div className="flex flex-col" style={{ minHeight: 380 }}>
      <div className="mb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Suporte InternLink</h3>
        </div>
        {conversationId && (
          <span className="text-xs text-muted-foreground">
            {hasAgent ? "Agente conectado" : "Esperando agente..."}
          </span>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {/* Messages area — fills remaining space */}
      <div className="flex-1 min-h-0 mb-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
        {!conversationId && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p>Envie a primeira mensagem para iniciar o chat de suporte.</p>
            <p className="text-xs">Um membro da equipa responderá assim que possível.</p>
          </div>
        )}
        {conversationId && messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Clock className="h-6 w-6" />
            <p>Esperando agente do suporte...</p>
            <p className="text-xs">Um membro da equipa entrará em breve.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={[
              "flex flex-col max-w-[80%] rounded-lg px-3 py-2 text-sm mb-2",
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

      {/* Input — fixed at bottom */}
      <div className="flex gap-2 shrink-0">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva a sua mensagem..."
          disabled={creating || sending}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={creating || sending || !text.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
