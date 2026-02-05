import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const steps = [
  {
    title: "Pedido de acesso",
    description: "A escola preenche o formulário e recebe confirmação por email.",
  },
  {
    title: "Criação do admin escolar",
    description: "É criado o perfil responsável que configura cursos e professores.",
  },
  {
    title: "Gestão completa",
    description: "A escola gere aprovações, turmas e alunos de forma autónoma.",
  },
]

const management = [
  {
    title: "Admins escolares",
    description: "Um responsável controla permissões e aprovações de contas.",
  },
  {
    title: "Professores e cursos",
    description: "Criação e organização de cursos, pastas e docentes associados.",
  },
  {
    title: "Visibilidade total",
    description: "Dashboards com evolução de protocolos e relatórios por turma.",
  },
]

export default function ParaEscolasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-16 space-y-12">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-wide text-primary">Para Escolas</p>
          <h1 className="text-4xl font-bold">Acesso simples e gestão autónoma</h1>
          <p className="text-muted-foreground">
            A InternLink foi pensada para escolas que querem acompanhar estágios curriculares com segurança,
            organização e comunicação centralizada.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/solicitar-acesso">Solicitar Acesso</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contacto">Falar connosco</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title}>
              <CardHeader>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {management.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card/80 p-8 shadow-lg">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">Pronta para começar?</h2>
            <p className="text-muted-foreground">
              Envie o pedido de acesso e ajudamos a configurar o ambiente inicial da sua escola.
            </p>
            <Button asChild>
              <Link href="/solicitar-acesso">Solicitar Acesso</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
