"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Polyfill for Map.prototype.getOrInsertComputed (TC39 proposal)
// Required for pdfjs-dist 5.6.x compatibility
if (!(Map.prototype as any).getOrInsertComputed) {
  (Map.prototype as any).getOrInsertComputed = function (this: Map<any, any>, key: any, computeFn: () => any) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = computeFn();
    this.set(key, value);
    return value;
  };
}

export type PdfPageInfo = {
  pageNumber: number;
  /** Largura renderizada em px (já com o scale aplicado). */
  width: number;
  /** Altura renderizada em px (já com o scale aplicado). */
  height: number;
  /** Referência ao container da página, usada para sobrepor overlays. */
  container: HTMLDivElement;
  /** Anotações de link (para interatividade). */
  links?: Array<{ rect: [number, number, number, number]; url?: string; dest?: string }>;
};

export type PdfViewerHandle = {
  getPages: () => PdfPageInfo[];
  reload: () => Promise<void>;
  goToPage: (pageNumber: number) => void;
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

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  try {
    const direct = await fetch(url, { cache: "no-store" });
    if (direct.ok) {
      return new Uint8Array(await direct.arrayBuffer());
    }
  } catch {
    // fallback below
  }

  // Fallback for remote URLs that fail direct browser fetch (CORS/auth edge-cases).
  const proxyUrl = `/api/files/proxy?url=${encodeURIComponent(url)}`;
  const proxied = await fetch(proxyUrl, { cache: "no-store" });
  if (!proxied.ok) {
    throw new Error("Falha a carregar PDF");
  }
  return new Uint8Array(await proxied.arrayBuffer());
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { fileUrl, fileBlobUrl, fileBytes, scale = 1.25, onPagesReady, onError, renderPageOverlay, className },
  ref
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<PdfPageInfo[]>([]);
  // Incremental token to detect and cancel stale concurrent loads
  const loadTokenRef = useRef(0);
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const clearSelectionOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".textLayer")) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        selection.removeAllRanges();
      }
    };

    document.addEventListener("pointerdown", clearSelectionOnOutsideClick, true);
    return () => {
      document.removeEventListener("pointerdown", clearSelectionOnOutsideClick, true);
    };
  }, []);

  const load = async () => {
    // mark this load as the active one
    const myLoadToken = ++loadTokenRef.current;

    pagesRef.current = [];
    setPages([]);
    setLoading(true);
    setErrorMessage(null);

    // Let React unmount portal overlays before clearing the container.
    // Using a double requestAnimationFrame gives React one full commit+paint
    // cycle to unmount portal components so their DOM containers are
    // no longer in use when we call `replaceChildren()` below. This
    // prevents orphaned portal content from remaining visible (duplication)
    // when changing `scale`/zoom.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    if (!rootRef.current) return;
    // ensure this load is still the active one before clearing DOM
    if (loadTokenRef.current !== myLoadToken) return;
    rootRef.current.replaceChildren();

    const source = fileBytes
      ? { data: fileBytes }
      : fileBlobUrl
        ? { data: await fetchPdfBytes(fileBlobUrl) }
        : fileUrl
          ? { data: await fetchPdfBytes(fileUrl) }
          : null;

    if (!source) {
      setLoading(false);
      return;
    }

    try {
      const pdfjs = await getPdfJs();
      const { TextLayerBuilder } = await import("pdfjs-dist/web/pdf_viewer.mjs");
      // If another load started while we awaited pdfjs, abort
      if (loadTokenRef.current !== myLoadToken) return;
      const loadingTask = pdfjs.getDocument(source as Parameters<typeof pdfjs.getDocument>[0]);
      const pdf = await loadingTask.promise;

      if (loadTokenRef.current !== myLoadToken) {
        try {
          loadingTask.destroy?.();
        } catch {}
        return;
      }

      const collected: PdfPageInfo[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        // If a new load started, abort appending further pages
        if (loadTokenRef.current !== myLoadToken) break;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const handleTextLayerAppend: (textLayerDiv: HTMLDivElement) => void = (textLayerDiv: HTMLDivElement) => {
          textLayerDiv.style.position = "absolute";
          textLayerDiv.style.inset = "0";
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;
          textLayerDiv.style.textAlign = "initial";
          textLayerDiv.style.overflow = "hidden";
          textLayerDiv.style.userSelect = "text";
          textLayerDiv.style.pointerEvents = "auto";
          textLayerDiv.style.color = "transparent";
          textLayerDiv.style.zIndex = "2";
        };
        const appendTextLayerDiv = (textLayerDiv: HTMLDivElement): void => {
          handleTextLayerAppend(textLayerDiv);
          pageWrap.appendChild(textLayerDiv);
        };

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
        canvas.style.pointerEvents = "none";

        const overlay = document.createElement("div");
        overlay.dataset.overlay = "true";
        overlay.style.position = "absolute";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";

        pageWrap.appendChild(canvas);
        const textLayerBuilder = new TextLayerBuilder({
          pdfPage: page,
          onAppend: appendTextLayerDiv,
        });
        
          // Links layer for interactive annotations
          const linksLayer = document.createElement("div");
          linksLayer.style.position = "absolute";
          linksLayer.style.inset = "0";
          linksLayer.style.pointerEvents = "none";
          pageWrap.appendChild(linksLayer);
        
        pageWrap.appendChild(overlay);
        // If a new load started, stop before touching the DOM
        if (loadTokenRef.current !== myLoadToken) break;
        rootRef.current.appendChild(pageWrap);

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

          // Extract link annotations
          const annotations = await page.getAnnotations();
          const links: PdfPageInfo["links"] = [];
        
          if (Array.isArray(annotations)) {
            for (const annotation of annotations) {
              if (annotation.subtype === "Link" && annotation.rect) {
                const [x1, y1, x2, y2] = annotation.rect;
                const vp = viewport.convertToViewportRectangle([x1, y1, x2, y2]);
                const [vpX1, vpY1, vpX2, vpY2] = vp;

                const linkEl = document.createElement("a");
                linkEl.style.position = "absolute";
                linkEl.style.left = `${Math.min(vpX1, vpX2)}px`;
                linkEl.style.top = `${Math.min(vpY1, vpY2)}px`;
                linkEl.style.width = `${Math.abs(vpX2 - vpX1)}px`;
                linkEl.style.height = `${Math.abs(vpY2 - vpY1)}px`;
                linkEl.style.cursor = "pointer";
                linkEl.style.pointerEvents = "auto";

                const url = (annotation as any).url || (annotation as any).URI;
                const dest = (annotation as any).dest;

                if (url) {
                  // External URL: open in new tab/window
                  linkEl.href = url;
                  linkEl.target = "_blank";
                  linkEl.rel = "noopener noreferrer";
                } else if (dest) {
                  // Internal destination within the PDF.
                  // Resolve destination on click and navigate to the target page.
                  linkEl.href = "#";
                  linkEl.addEventListener("click", async (ev) => {
                    ev.preventDefault();
                    try {
                      let destArray: any = dest;
                      if (typeof dest === "string") {
                        destArray = await pdf.getDestination(dest);
                      }
                      if (!destArray || !destArray[0]) return;
                      const pageRef = destArray[0];
                      const destPageIndex = await pdf.getPageIndex(pageRef);
                      const destPageNumber = destPageIndex + 1;

                      if (!rootRef.current) return;
                      const target = rootRef.current.querySelector(`[data-page-number="${destPageNumber}"]`);
                      if (target) {
                        (target as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    } catch {
                      // ignore resolution errors
                    }
                  });
                }

                linksLayer.appendChild(linkEl);
                links.push({ rect: [vpX1, vpY1, vpX2, vpY2], url, dest });
              }
            }
          }

          await textLayerBuilder.render({ viewport, images: null as any });

        collected.push({
          pageNumber,
          width: viewport.width,
          height: viewport.height,
          container: overlay,
            links,
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
      goToPage: (pageNumber: number) => {
        if (!rootRef.current) return;
        const pageEl = rootRef.current.querySelector(`[data-page-number="${pageNumber}"]`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
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
