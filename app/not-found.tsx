import Link from "next/link";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.16),_transparent_32%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
        <div className="w-full rounded-3xl border border-border bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur">
          <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <span>Página não encontrada</span>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-primary">404</p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                O endereço não existe ou o site está temporariamente indisponível.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Verifica o link, volta ao início ou entra novamente na tua área. Se algo tiver falhado no carregamento,
                esta página dá-te um ponto de retorno seguro.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Ir para a página inicial
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao login
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 via-cyan-400/10 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-background/60 p-6 shadow-lg">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.32em] text-muted-foreground">
                  <span>InternLink</span>
                  <span>Offline-safe</span>
                </div>
                <div className="mt-8 flex items-end gap-3">
                  <div className="h-24 w-4 rounded-full bg-primary/20" />
                  <div className="h-36 w-4 rounded-full bg-primary/35" />
                  <div className="h-16 w-4 rounded-full bg-primary/15" />
                  <div className="h-28 w-4 rounded-full bg-primary/25" />
                  <div className="h-20 w-4 rounded-full bg-primary/18" />
                  <div className="h-32 w-4 rounded-full bg-primary/30" />
                </div>
                <div className="mt-6 rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">Se esperavas outra rota</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pode ter sido movida, removida ou estar temporariamente indisponível.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
