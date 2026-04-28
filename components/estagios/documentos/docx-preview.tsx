"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  fileBytes: Uint8Array | null;
  className?: string;
};

export function DocxPreview({ fileBytes, className }: Props) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileBytes) {
      setHtml("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const mammoth = (await import(
          /* webpackIgnore: true */ "mammoth/mammoth.browser" as string
        )) as {
          convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };
        const arrayBuffer = fileBytes.buffer.slice(
          fileBytes.byteOffset,
          fileBytes.byteOffset + fileBytes.byteLength,
        ) as ArrayBuffer;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;
        setHtml(result.value || "<p><em>Documento sem conteúdo legível.</em></p>");
      } catch (err) {
        console.error("[v0] docx preview error", err);
        if (!cancelled) setError("Não foi possível pré-visualizar este DOCX.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileBytes]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A processar pré-visualização...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Selecione um ficheiro para pré-visualizar.
      </div>
    );
  }

  return (
    <article
      className={[
        "docx-preview rounded-md border bg-card px-6 py-4 text-sm leading-relaxed text-foreground",
        className ?? "",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
