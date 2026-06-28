"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronLeft, ChevronRight, CreditCard, School } from "lucide-react";

const PLANS = [
  { id: "starter", name: "Starter", price: "30€", period: "pagamento único", limits: "5 professores, 60 alunos" },
  { id: "organisation", name: "Organisation", price: "250€", period: "/ano", limits: "50 professores, 3000 alunos" },
];

export default function RequestAccessPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [schoolName, setSchoolName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");

  // Step 2
  const [selectedPlan, setSelectedPlan] = useState("starter");

  const canGoNext = schoolName.trim() && contactEmail.trim() && contactName.trim() && role.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/school-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          contactEmail: contactEmail.trim(),
          contactName: contactName.trim(),
          role: role.trim(),
          message: message.trim() || null,
          plan: selectedPlan,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao enviar.");
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError("Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/"><ChevronLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={step === 1 ? "default" : "secondary"}>Passo 1</Badge>
          <div className="h-px flex-1 bg-border" />
          <Badge variant={step === 2 ? "default" : "secondary"}>Passo 2</Badge>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Enliste a sua Escola</CardTitle>
            <CardDescription>
              {step === 1
                ? "Preencha os dados da escola e o contacto do responsável."
                : "Selecione o plano e os dados de pagamento."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { if (step === 2) handleSubmit(e); else e.preventDefault(); }} className="space-y-5">
              {/* STEP 1: School info */}
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="schoolName">Nome da escola *</Label>
                    <Input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Escola Secundária de..." required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email institucional *</Label>
                    <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contacto@escola.pt" required />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Nome do responsável *</Label>
                      <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome completo" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Cargo *</Label>
                      <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Direção, coordenação..." required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem (opcional)</Label>
                    <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Deixe detalhes adicionais..." />
                  </div>
                </>
              )}

              {/* STEP 2: Plan + payment */}
              {step === 2 && (
                <>
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Selecione o plano</Label>
                    <div className="grid gap-3 md:grid-cols-2">
                      {PLANS.map((plan) => (
                        <button
                          type="button"
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan.id)}
                          className={[
                            "flex flex-col rounded-lg border p-4 cursor-pointer transition-colors hover:border-primary/50 text-left",
                            selectedPlan === plan.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{plan.name}</span>
                            {selectedPlan === plan.id && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-2xl font-bold">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
                          <p className="text-xs text-muted-foreground mt-1">{plan.limits}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pagamento (via Stripe)</span>
                      <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O pagamento será processado via Stripe quando a sua escola for aprovada.
                      Por enquanto, submeta o formulário e entraremos em contacto para finalizar.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2 opacity-50 pointer-events-none">
                      <Input placeholder="Número do cartão" disabled />
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="MM/AA" disabled />
                        <Input placeholder="CVC" disabled />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {submitted && !error && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800">Pedido enviado com sucesso! Entraremos em contacto em breve.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {step === 2 && !submitted && (
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                  </Button>
                )}
                {step === 1 && (
                  <Button type="button" onClick={() => setStep(2)} disabled={!canGoNext} className="flex-1">
                    Seguinte <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                {step === 2 && !submitted && (
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "A enviar..." : "Submeter pedido"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
