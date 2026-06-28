"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TermosPage() {
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/api/landing-content", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: { content?: { legal?: { termos?: string } } }) => setContent(d.content?.legal?.termos || ""))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <h1 className="text-4xl font-bold">Termos</h1>
        <p className="text-muted-foreground whitespace-pre-wrap">
          {content || "Conteúdo de termos em preparação. Estes termos irão descrever as regras de utilização da InternLink."}
        </p>
      </div>
    </div>
  );
}
