"use client";

import { useEffect } from "react";

export const TRANSITION_PORTAL_MS = 3600;

export function AccessValidationOverlay() {
  useEffect(() => {
    if (typeof document === "undefined" || !document.body) {
      return;
    }

    document.body.classList.add("transition-overlay-active");

    return () => {
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.remove("transition-overlay-active");
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483647] overflow-hidden bg-background backdrop-blur-0 animate-[transition-overlay-blur_3600ms_ease-in-out_forwards]" aria-live="polite" aria-label="InternLink transition">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.24),transparent_58%)]" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-4 animate-[transition-brand-zoom_3600ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
          <img src="/icon.svg" alt="InternLink" className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-[0.12em] text-foreground">InternLink</span>
        </div>
      </div>
    </div>
  );
}