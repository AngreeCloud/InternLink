"use client";

import { Loader2 } from "lucide-react";

export function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background/92 px-4 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(6,182,212,0.18),_transparent_30%),radial-gradient(circle_at_center,_rgba(255,255,255,0.04),_transparent_42%)]" />
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:52px_52px]" />

      <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl animate-[logout-glow_2.8s_ease-in-out_infinite]" />

      <div className="relative w-full max-w-3xl rounded-[2rem] border border-border/80 bg-card/96 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
                <Loader2 className="h-8 w-8 animate-spin [animation-duration:0.9s]" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-card-foreground">A terminar sessão</p>
                <p className="text-sm text-muted-foreground">
                  A tua sessão está a ser encerrada e o acesso será removido já a seguir.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Estamos a limpar o estado local e a sincronizar a sessão para evitar flashes ou erros enquanto o acesso termina.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="h-4 overflow-hidden rounded-full bg-muted/90 shadow-inner">
              <div className="h-full w-1/2 rounded-full bg-[length:200%_100%] bg-gradient-to-r from-primary via-cyan-300 to-primary animate-[logout-progress_0.95s_linear_infinite]" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/60 px-3 py-2">Sessão</div>
              <div className="rounded-xl border border-border bg-background/60 px-3 py-2">Cookie</div>
              <div className="rounded-xl border border-border bg-background/60 px-3 py-2">Redirecionamento</div>
            </div>

            <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <span>Sincronizando</span>
              <span>A concluir</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
