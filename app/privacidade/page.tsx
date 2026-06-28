"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PrivacidadePage() {
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/api/landing-content")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: { content?: { legal?: { privacidade?: string } } }) => setContent(d.content?.legal?.privacidade || ""))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <h1 className="text-4xl font-bold">Privacidade</h1>
        <p className="text-muted-foreground whitespace-pre-wrap">
          {content || "Política de privacidade em preparação. Aqui será explicado como tratamos e protegemos os dados."}
        </p>
      </div>
    </div>
  );
}
