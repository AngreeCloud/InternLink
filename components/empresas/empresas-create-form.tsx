"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { validateNIF } from "@/lib/validators/nif";

type Props = {
  basePath: string;
};

export function EmpresasCreateForm({ basePath }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [setor, setSetor] = useState("");
  const [website, setWebsite] = useState("");
  const [descricao, setDescricao] = useState("");
  const [morada, setMorada] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [concelho, setConcelho] = useState("");
  const [distrito, setDistrito] = useState("");
  const [emailGeral, setEmailGeral] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError("O nome da empresa é obrigatório.");
      return;
    }

    if (nif.trim()) {
      const nifCheck = validateNIF(nif);
      if (!nifCheck.valid) {
        setError(nifCheck.message ?? "NIF inválido");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          nif: nif.trim() || undefined,
          setor: setor.trim() || undefined,
          website: website.trim() || undefined,
          descricao: descricao.trim() || undefined,
          morada: morada.trim() || undefined,
          codigoPostal: codigoPostal.trim() || undefined,
          localidade: localidade.trim() || undefined,
          concelho: concelho.trim() || undefined,
          distrito: distrito.trim() || undefined,
          emailGeral: emailGeral.trim() || undefined,
          telefone: telefone.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Erro ao criar empresa.");
        return;
      }

      router.push(`${basePath}/empresas/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/empresas`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nova Empresa</h1>
          <p className="text-muted-foreground">Regista uma nova entidade de acolhimento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Identificação</h2>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input id="nif" value={nif} onChange={(e) => setNif(e.target.value)} placeholder="501234567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Input id="setor" value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: Tecnologias de Informação" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição da empresa" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Localização</h2>
          <div className="space-y-2">
            <Label htmlFor="morada">Morada</Label>
            <Input id="morada" value={morada} onChange={(e) => setMorada(e.target.value)} placeholder="Rua ..." />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="codigoPostal">Código Postal</Label>
              <Input id="codigoPostal" value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} placeholder="4480-xxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localidade">Localidade</Label>
              <Input id="localidade" value={localidade} onChange={(e) => setLocalidade(e.target.value)} placeholder="Vila do Conde" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="concelho">Concelho</Label>
              <Input id="concelho" value={concelho} onChange={(e) => setConcelho(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distrito">Distrito</Label>
              <Input id="distrito" value={distrito} onChange={(e) => setDistrito(e.target.value)} placeholder="Porto" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Contacto</h2>
          <div className="space-y-2">
            <Label htmlFor="emailGeral">Email Geral</Label>
            <Input id="emailGeral" type="email" value={emailGeral} onChange={(e) => setEmailGeral(e.target.value)} placeholder="geral@..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="252 000 000" />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "A criar..." : "Criar Empresa"}
        </Button>
      </form>
    </div>
  );
}
