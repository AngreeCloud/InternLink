"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LicencaPage() {
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/api/landing-content")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: { content?: { legal?: { licenca?: string } } }) => setContent(d.content?.legal?.licenca || ""))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <h1 className="text-4xl font-bold">Licença</h1>
        <p className="text-muted-foreground whitespace-pre-wrap">
          {content || "A InternLink é um projeto académico. Informação de licença em preparação."}
        </p>
      </div>
    </div>
  );
}
