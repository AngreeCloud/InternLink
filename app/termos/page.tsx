import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <h1 className="text-4xl font-bold">Termos</h1>
        <p className="text-muted-foreground">
          Conteúdo de termos em preparação. Estes termos irão descrever as regras de utilização da InternLink.
        </p>
      </div>
    </div>
  )
}
