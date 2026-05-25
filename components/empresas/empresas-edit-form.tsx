"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";

type EmpresaData = {
  nome: string;
  nif?: string;
  setor?: string;
  website?: string;
  descricao?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  concelho?: string;
  distrito?: string;
  pais?: string;
  emailGeral?: string;
  telefone?: string;
};

type Props = {
  empresaId: string;
  initial: EmpresaData;
  onSaved: () => void;
  onCancel: () => void;
};

export function EmpresasEditForm({ empresaId, initial, onSaved, onCancel }: Props) {
  const [nome, setNome] = useState(initial.nome);
  const [nif, setNif] = useState(initial.nif ?? "");
  const [setor, setSetor] = useState(initial.setor ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [descricao, setDescricao] = useState(initial.descricao ?? "");
  const [morada, setMorada] = useState(initial.morada ?? "");
  const [codigoPostal, setCodigoPostal] = useState(initial.codigoPostal ?? "");
  const [localidade, setLocalidade] = useState(initial.localidade ?? "");
  const [concelho, setConcelho] = useState(initial.concelho ?? "");
  const [distrito, setDistrito] = useState(initial.distrito ?? "");
  const [pais, setPais] = useState(initial.pais ?? "");
  const [emailGeral, setEmailGeral] = useState(initial.emailGeral ?? "");
  const [telefone, setTelefone] = useState(initial.telefone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError("O nome da empresa é obrigatório.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
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
          pais: pais.trim() || undefined,
          emailGeral: emailGeral.trim() || undefined,
          telefone: telefone.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Erro ao guardar alterações.");
        return;
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Editar Empresa</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Identificação</h3>
        <div className="space-y-2">
          <Label htmlFor="edit-nome">Nome *</Label>
          <Input id="edit-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-nif">NIF</Label>
            <Input id="edit-nif" value={nif} onChange={(e) => setNif(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-setor">Setor</Label>
            <Input id="edit-setor" value={setor} onChange={(e) => setSetor(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-website">Website</Label>
          <Input id="edit-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-descricao">Descrição</Label>
          <Input id="edit-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Localização</h3>
        <div className="space-y-2">
          <Label htmlFor="edit-morada">Morada</Label>
          <Input id="edit-morada" value={morada} onChange={(e) => setMorada(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-codigoPostal">Código Postal</Label>
            <Input id="edit-codigoPostal" value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-localidade">Localidade</Label>
            <Input id="edit-localidade" value={localidade} onChange={(e) => setLocalidade(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-concelho">Concelho</Label>
            <Input id="edit-concelho" value={concelho} onChange={(e) => setConcelho(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-distrito">Distrito</Label>
            <Input id="edit-distrito" value={distrito} onChange={(e) => setDistrito(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-pais">País</Label>
          <Input id="edit-pais" value={pais} onChange={(e) => setPais(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Contacto</h3>
        <div className="space-y-2">
          <Label htmlFor="edit-emailGeral">Email Geral</Label>
          <Input id="edit-emailGeral" type="email" value={emailGeral} onChange={(e) => setEmailGeral(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-telefone">Telefone</Label>
          <Input id="edit-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "A guardar..." : "Guardar Alterações"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
