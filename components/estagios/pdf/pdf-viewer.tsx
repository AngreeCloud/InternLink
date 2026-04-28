"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type PdfPageInfo = {
  pageNumber: number;
  /** Largura renderizada em px (já com o scale aplicado). */
  width: number;
  /** Altura renderizada em px (já com o scale aplicado). */
  height: number;
  /** Referência ao container da página, usada para sobrepor overlays. */
  container: HTMLDivElement;
};

export type PdfViewerHandle = {
  getPages: () => PdfPageInfo[];
  reload: () => Promise<void>;
};

type PdfViewerProps = {
  fileUrl?: string;
  fileBlobUrl?: string;
  fileBytes?: Uint8Array;
  scale?: number;
  onPagesReady?: (pages: PdfPageInfo[]) => void;
  onError?: (error: Error) => void;
  /** Renderiza um slot em cada página, útil para overlays (caixas de assinatura). */
  renderPageOverlay?: (info: PdfPageInfo) => React.ReactNode;
  className?: string;
};

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { fileUrl, fileBlobUrl, fileBytes, scale = 1.25, onPagesReady, onError, renderPageOverlay, className },
  ref
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<PdfPageInfo[]>([]);
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    pagesRef.current = [];
    setPages([]);
    setLoading(true);
    setErrorMessage(null);

    // Let React unmount portal overlays before clearing the container.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    if (!rootRef.current) return;
    rootRef.current.replaceChildren();

    const source = fileBytes
      ? { data: fileBytes }
      : fileBlobUrl
        ? { url: fileBlobUrl }
        : fileUrl
          ? { url: fileUrl, withCredentials: false }
          : null;

    if (!source) {
      setLoading(false);
      return;
    }

    try {
      const pdfjs = await getPdfJs();
      const loadingTask = pdfjs.getDocument(source as Parameters<typeof pdfjs.getDocument>[0]);
      const pdf = await loadingTask.promise;

      const collected: PdfPageInfo[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const pageWrap = document.createElement("div");
        pageWrap.dataset.pageNumber = String(pageNumber);
        pageWrap.style.position = "relative";
        pageWrap.style.width = `${viewport.width}px`;
        pageWrap.style.height = `${viewport.height}px`;
        pageWrap.style.margin = "0 auto 16px auto";
        pageWrap.style.background = "#fff";
        pageWrap.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        pageWrap.style.border = "1px solid var(--border, #e5e7eb)";

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = "block";

        const overlay = document.createElement("div");
        overlay.dataset.overlay = "true";
        overlay.style.position = "absolute";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";

        pageWrap.appendChild(canvas);
        pageWrap.appendChild(overlay);
        root.appendChild(pageWrap);

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        collected.push({
          pageNumber,
          width: viewport.width,
          height: viewport.height,
          container: overlay,
        });
      }

      pagesRef.current = collected;
      setPages(collected);
      setLoading(false);
      onPagesReady?.(collected);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Falha a carregar PDF");
      setErrorMessage(err.message);
      setLoading(false);
      onError?.(err);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, fileBlobUrl, fileBytes, scale]);

  useImperativeHandle(ref, () => ({
    getPages: () => pagesRef.current,
    reload: load,
  }));

  return (
    <div className={className ?? "w-full"}>
      <div ref={rootRef} className="mx-auto w-fit" />
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">A carregar PDF...</p>
      ) : null}
      {errorMessage ? (
        <p className="py-6 text-center text-sm text-destructive">{errorMessage}</p>
      ) : null}
      {!loading && pages.length > 0 && renderPageOverlay
        ? pages.map((info) => (
            <PortalIntoContainer key={info.pageNumber} container={info.container}>
              {renderPageOverlay(info)}
            </PortalIntoContainer>
          ))
        : null}
    </div>
  );
});

function PortalIntoContainer({
  container,
  children,
}: {
  container: HTMLElement;
  children: React.ReactNode;
}) {
  const [PortalModule, setPortalModule] = useState<typeof import("react-dom") | null>(null);

  useEffect(() => {
    let active = true;
    import("react-dom").then((mod) => {
      if (active) setPortalModule(mod);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!PortalModule) return null;
  return PortalModule.createPortal(children, container);
}
