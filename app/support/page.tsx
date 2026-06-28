"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, AlertCircle } from "lucide-react";

type Ticket = {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed";
  priority?: string;
  assignedTo?: string;
  conversationId?: string;
  createdAt?: { _seconds: number } | string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  closed: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em progresso",
  closed: "Fechado",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("open");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTickets = useCallback(() => {
    setLoading(true);
    fetch("/api/support/tickets")
      .then((r) => r.json())
      .then((d: { tickets?: Ticket[] }) => setTickets(d.tickets || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const updateTicket = async (ticketId: string, updates: Record<string, string>) => {
    setActionLoading(ticketId);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, ...updates }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar.");
      fetchTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = tickets.filter((t) => tab === "all" || t.status === tab);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
  }

  if (error) {
    return <Card className="border-destructive/40"><CardContent className="py-4 text-sm text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tickets de Suporte</h1>
        <p className="text-sm text-muted-foreground">Gerir pedidos de suporte dos utilizadores.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Abertos ({tickets.filter((t) => t.status === "open").length})</TabsTrigger>
          <TabsTrigger value="in_progress">Em progresso ({tickets.filter((t) => t.status === "in_progress").length})</TabsTrigger>
          <TabsTrigger value="closed">Fechados ({tickets.filter((t) => t.status === "closed").length})</TabsTrigger>
          <TabsTrigger value="all">Todos ({tickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="pt-4 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
          ) : (
            filtered.map((ticket) => (
              <Card key={ticket.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate">{ticket.title}</span>
                        <Badge className={STATUS_COLORS[ticket.status] || ""}>{STATUS_LABELS[ticket.status] || ticket.status}</Badge>
                      </div>
                      {ticket.description && <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        {ticket.userName || "Utilizador"} — {ticket.userEmail || ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ticket.status !== "closed" && (
                        <Select
                          value={ticket.status}
                          onValueChange={(val) => updateTicket(ticket.id, { status: val })}
                          disabled={actionLoading === ticket.id}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Aberto</SelectItem>
                            <SelectItem value="in_progress">Em progresso</SelectItem>
                            <SelectItem value="closed">Fechado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
