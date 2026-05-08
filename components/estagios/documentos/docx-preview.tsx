"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  fileBytes: Uint8Array | null;
  className?: string;
};

export function DocxPreview({ fileBytes, className }: Props) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        let sanitizedHtml = result.value || "<p><em>Documento sem conteúdo legível.</em></p>";
        setHtml(sanitizedHtml);
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

  // Interceptar cliques em links para abrir em novo tab
  useEffect(() => {
    if (!containerRef.current || !html) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      
      if (link && link.href) {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }
    };

    containerRef.current.addEventListener("click", handleLinkClick);
    return () => {
      containerRef.current?.removeEventListener("click", handleLinkClick);
    };
  }, [html]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
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
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Selecione um ficheiro para pré-visualizar.
      </div>
    );
  }

  return (
    <article
      ref={containerRef}
      className={[
        "docx-preview select-text text-sm leading-relaxed text-foreground",
        className ?? "rounded-md border bg-card px-6 py-4",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
