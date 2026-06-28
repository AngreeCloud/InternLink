"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { School, Users, Headset, FileText } from "lucide-react";

type Stats = {
  totalUsers: number;
  totalSchools: number;
  totalLeads: number;
  totalSupportAccounts: number;
};

async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/super-admin/stats");
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || "Falha ao carregar estatísticas.");
  }
  return res.json() as Promise<Stats>;
}

export default function SuperAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">Painel de controlo do Super Admin.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Visão Geral</h1>
        </div>
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const cards = [
    { title: "Utilizadores Ativos", value: stats?.totalUsers ?? 0, icon: Users, description: "Contas na plataforma" },
    { title: "Escolas Registadas", value: stats?.totalSchools ?? 0, icon: School, description: "Escolas ativas" },
    { title: "Leads de Escola", value: stats?.totalLeads ?? 0, icon: FileText, description: "Formulários de enliste" },
    { title: "Contas Support", value: stats?.totalSupportAccounts ?? 0, icon: Headset, description: "Agentes de suporte" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">Painel de controlo do Super Admin.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
