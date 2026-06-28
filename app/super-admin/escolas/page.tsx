"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Copy, Check, AlertCircle, School } from "lucide-react";

type CreateResult = {
  schoolId: string;
  adminEmail: string;
  adminPassword: string;
  adminUid: string;
};

type Lead = {
  id: string;
  schoolName?: string;
  contactEmail?: string;
  contactName?: string;
  role?: string;
  message?: string;
  status?: string;
  plan?: string;
  createdAt?: { _seconds: number } | string;
  source?: string;
};

export default function EscolasPage() {
  // Create school form
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [educationLevel, setEducationLevel] = useState("Secundária/Profissional");
  const [emailDomain, setEmailDomain] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [requests, setRequests] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/leads")
      .then((res) => res.json())
      .then((data: { leads?: Lead[]; requests?: Lead[] }) => {
        setLeads(data.leads || []);
        setRequests(data.requests || []);
      })
      .catch((err) => setLeadsError(err.message))
      .finally(() => setLeadsLoading(false));
  }, []);

  const handleCreateSchool = async () => {
    setError(null);
    setResult(null);
    if (!name || !shortName || !adminEmail || !adminName) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/super-admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, shortName, address, contact, educationLevel, emailDomain, adminEmail, adminName }),
      });
      const data = (await res.json()) as CreateResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error || "Erro ao criar escola.");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    const text = `Email: ${result.adminEmail}\nPassword: ${result.adminPassword}\nSchool ID: ${result.schoolId}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Escolas & Leads</h1>
        <p className="text-sm text-muted-foreground">Criar escolas e ver formulários de enliste.</p>
      </div>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Criar Escola</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length + requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova Escola</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da escola *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Escola Secundária de..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortName">Nome curto *</Label>
                  <Input id="shortName" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="ESRP" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Morada</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contacto</Label>
                  <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Telefone ou email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="educationLevel">Nível de ensino</Label>
                  <Input id="educationLevel" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailDomain">Domínio email (opcional)</Label>
                  <Input id="emailDomain" value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} placeholder="@escola.pt" />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Admin escolar associado</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="adminName">Nome do admin *</Label>
                    <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmailField">Email do admin *</Label>
                    <Input id="adminEmailField" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@escola.pt" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button onClick={handleCreateSchool} disabled={submitting}>
                {submitting ? "A criar..." : "Criar Escola + Admin"}
              </Button>

              {result && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="space-y-2 py-4">
                    <p className="font-semibold text-green-800">Escola criada com sucesso!</p>
                    <div className="space-y-1 text-sm text-green-700">
                      <p><strong>Escola ID:</strong> {result.schoolId}</p>
                      <p><strong>Admin Email:</strong> {result.adminEmail}</p>
                      <p><strong>Admin Password:</strong> {result.adminPassword}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyCredentials}>
                      {copied ? <><Check className="mr-2 h-3 w-3" /> Copiado</> : <><Copy className="mr-2 h-3 w-3" /> Copiar credenciais</>}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="pt-4">
          {leadsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : leadsError ? (
            <Card className="border-destructive/40">
              <CardContent className="py-4 text-sm text-destructive">{leadsError}</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {leads.length === 0 && requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
              ) : (
                <>
                  {leads.map((lead) => (
                    <Card key={lead.id}>
                      <CardContent className="flex items-start justify-between py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <School className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{lead.schoolName || "—"}</span>
                            {lead.plan && <Badge variant="secondary">{lead.plan}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{lead.contactName || "—"} — {lead.contactEmail || "—"}</p>
                          <p className="text-xs text-muted-foreground">{lead.role || "—"}</p>
                        </div>
                        <Badge variant={lead.status === "pending" ? "outline" : "default"}>
                          {lead.status || "pending"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {requests.map((req) => (
                    <Card key={req.id}>
                      <CardContent className="flex items-start justify-between py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <School className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{req.schoolName || "—"}</span>
                            <Badge variant="outline" className="text-[10px]">Solicitar Acesso</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{req.contactName || "—"} — {req.contactEmail || "—"}</p>
                        </div>
                        <Badge variant="outline">{req.status || "pending"}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
