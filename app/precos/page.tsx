"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Check, ArrowRight, ChevronRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "30",
    period: "pagamento único",
    description: "Ideal para escolas que estão a começar.",
    limits: "5 professores, 60 alunos",
    features: [
      "Gestão integrada de estágios",
      "Chat entre alunos, professores e tutores",
      "Documentos e protocolos centralizados",
      "Aprovação de contas e validações",
      "Relatórios e indicadores de progresso",
      "Notificações em tempo real",
      "Suporte por ticket",
    ],
    cta: "Enlistar escola",
    href: "/solicitar-acesso",
    highlighted: false,
  },
  {
    name: "Organisation",
    price: "250",
    period: "/ano",
    description: "Para escolas com vários cursos e grande volume de alunos.",
    limits: "50 professores, 3000 alunos",
    features: [
      "Tudo do plano Starter",
      "Gestão multi-curso avançada",
      "Limites alargados de utilizadores",
      "Suporte prioritário",
      "Personalização de marca (brevemente)",
      "API de integração (brevemente)",
    ],
    cta: "Enlistar escola",
    href: "/solicitar-acesso",
    highlighted: true,
  },
];

export default function PrecosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span>InternLink</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="/#funcionalidades" className="hover:text-foreground">Funcionalidades</Link>
            <Link href="/precos" className="font-medium text-primary">Preços</Link>
            <Link href="/sobre" className="hover:text-foreground">Sobre</Link>
            <Link href="/contacto" className="hover:text-foreground">Contacto</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 space-y-16">
        <section className="space-y-6 text-center">
          <Badge variant="secondary" className="text-sm px-3 py-1">Beta</Badge>
          <h1 className="text-4xl font-bold">Planos e Preços</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Escolha o plano que melhor se adapta à sua escola. Os limites de utilizadores são informativos —
            contacte-nos se precisar de mais capacidade.
          </p>
        </section>

        <section className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={[
                "flex flex-col",
                plan.highlighted ? "border-primary shadow-lg ring-1 ring-primary/20 scale-[1.02]" : "",
              ].join(" ")}
            >
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  {plan.highlighted && (
                    <Badge className="bg-primary text-primary-foreground">Recomendado</Badge>
                  )}
                </div>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-3">
                  <span className="text-4xl font-bold">{plan.price}€</span>
                  <span className="text-muted-foreground"> {plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.limits}</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"} size="lg">
                  <Link href={plan.href} className="flex items-center gap-2">
                    {plan.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card/80 p-8 text-center shadow-lg max-w-2xl mx-auto">
          <Badge className="mb-4 bg-amber-100 text-amber-800 border-amber-200">Coming Soon</Badge>
          <h2 className="text-2xl font-semibold mb-3">Pagamento via Stripe (brevemente)</h2>
          <p className="text-muted-foreground mb-6">
            O processamento de pagamentos será integrado com Stripe em breve.
            Por enquanto, o plano é selecionado no formulário de enliste e a faturação é tratada manualmente.
          </p>
          <Button asChild variant="outline">
            <Link href="/solicitar-acesso">
              Enlistar escola <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border bg-background/90">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span>InternLink</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Plataforma de gestão de estágios curriculares para escolas, alunos e empresas.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Planos</p>
              <Link href="/precos" className="block text-muted-foreground hover:text-foreground">Preços</Link>
              <Link href="/solicitar-acesso" className="block text-muted-foreground hover:text-foreground">Enlistar escola</Link>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Recursos</p>
              <Link href="/para-escolas" className="block text-muted-foreground hover:text-foreground">Para Escolas</Link>
              <Link href="/sobre" className="block text-muted-foreground hover:text-foreground">Sobre</Link>
              <Link href="/contacto" className="block text-muted-foreground hover:text-foreground">Contacto</Link>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Legal</p>
              <Link href="/termos" className="block text-muted-foreground hover:text-foreground">Termos</Link>
              <Link href="/privacidade" className="block text-muted-foreground hover:text-foreground">Privacidade</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} InternLink. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
