"use client";

import { Loader2 } from "lucide-react";

export function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 px-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/95 p-6 shadow-2xl shadow-black/10">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-card-foreground">A terminar sessão</p>
            <p className="text-sm text-muted-foreground">Aguarda um instante enquanto limpamos a tua sessão.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary via-cyan-400 to-primary animate-[logout-progress_1.4s_ease-in-out_infinite]" />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sincronizando sessão</span>
            <span>Redirecionando...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
