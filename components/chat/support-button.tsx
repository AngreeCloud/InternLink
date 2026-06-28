"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, Loader2, CheckCircle } from "lucide-react";

type SupportButtonProps = {
  userId?: string;
  userName?: string;
  userEmail?: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "default" | "icon";
};

export function SupportButton({ userId, userName, userEmail, variant = "ghost", size = "sm" }: SupportButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Descreva o problema.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), userId, userName, userEmail }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao criar ticket.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSubmitted(false); setTitle(""); setDescription(""); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <MessageSquare className="h-4 w-4" />
          {size !== "icon" && <span className="ml-2">Suporte</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suporte Técnico</DialogTitle>
          <DialogDescription>Descreva o seu problema e a nossa equipa responderá o mais rápido possível.</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-sm text-center text-muted-foreground">Ticket criado com sucesso. A equipa de suporte entrará em contacto em breve.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Assunto</Label>
              <Input id="ticket-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descreva o problema em poucas palavras" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-desc">Descrição (opcional)</Label>
              <Textarea id="ticket-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Detalhes adicionais..." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {!submitted && (
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar...</> : "Enviar ticket"}
            </Button>
          )}
          {submitted && <Button variant="outline" onClick={() => setOpen(false)} className="w-full">Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
