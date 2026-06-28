"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, AlertCircle, Headset } from "lucide-react";

type SupportAccount = {
  uid: string;
  email: string;
  nome: string;
  estado: string;
  createdAt?: { _seconds: number } | string;
};

type CreateResult = {
  ok: boolean;
  uid: string;
  email: string;
  password: string;
};

export default function SupportPage() {
  const [accounts, setAccounts] = useState<SupportAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAccounts = () => {
    setLoading(true);
    fetch("/api/super-admin/support")
      .then((res) => res.json())
      .then((data: { accounts?: SupportAccount[] }) => setAccounts(data.accounts || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async () => {
    setCreateError(null);
    setResult(null);
    if (!email || !name) {
      setCreateError("Preencha todos os campos.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/super-admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = (await res.json()) as CreateResult & { error?: string };
      if (!res.ok || data.error) {
        setCreateError(data.error || "Erro ao criar conta.");
        return;
      }
      setResult(data);
      setEmail("");
      setName("");
      fetchAccounts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nPassword: ${result.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contas Support</h1>
        <p className="text-sm text-muted-foreground">Gerir agentes de suporte técnico.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar nova conta support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do agente" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agente@support.com" />
            </div>
          </div>

          {createError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {createError}
            </div>
          )}

          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "A criar..." : "Criar Conta Support"}
          </Button>

          {result && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="space-y-2 py-4">
                <p className="font-semibold text-green-800">Conta support criada!</p>
                <div className="space-y-1 text-sm text-green-700">
                  <p><strong>Email:</strong> {result.email}</p>
                  <p><strong>Password:</strong> {result.password}</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyCredentials}>
                  {copied ? <><Check className="mr-2 h-3 w-3" /> Copiado</> : <><Copy className="mr-2 h-3 w-3" /> Copiar credenciais</>}
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta support encontrada.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.uid} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <Headset className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{account.nome}</p>
                      <p className="text-xs text-muted-foreground">{account.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
