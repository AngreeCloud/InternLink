import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const highlights = [
  {
    title: "Objetivo",
    content:
      "Facilitar a gestão de estágios curriculares entre escolas, alunos e empresas, com transparência e rapidez.",
  },
  {
    title: "Problema que resolve",
    content:
      "Comunicação fragmentada, falta de visibilidade sobre aprovações e organização de documentação dispersa.",
  },
  {
    title: "Tecnologias",
    content: "Next.js, React, Tailwind CSS e Firebase para autenticação e base de dados.",
  },
  {
    title: "Autor",
    content: "Miguel Pedrosa — Projeto PAP com foco em impacto real nas escolas.",
  },
]

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-16 space-y-10">
        <section className="space-y-3">
          <p className="text-sm uppercase tracking-wide text-primary">Sobre</p>
          <h1 className="text-4xl font-bold">Porque nasceu a InternLink</h1>
          <p className="text-muted-foreground">
            A InternLink é uma plataforma académica concebida para transformar o acompanhamento dos estágios
            curriculares. O objetivo é dar às escolas uma solução moderna e centralizada.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {highlights.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.content}</CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}
