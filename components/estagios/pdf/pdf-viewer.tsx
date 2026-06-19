"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";

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
  width: number;
  height: number;
  container: HTMLDivElement;
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
  renderPageOverlay?: (info: PdfPageInfo) => React.ReactNode;
  className?: string;
  interactiveLinks?: boolean;
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
  }

  const proxyUrl = `/api/files/proxy?url=${encodeURIComponent(url)}`;
  const proxied = await fetch(proxyUrl, { cache: "no-store" });
  if (!proxied.ok) {
    throw new Error("Falha a carregar PDF");
  }
  return new Uint8Array(await proxied.arrayBuffer());
}

function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
  while (el) {
    const style = getComputedStyle(el);
    if (style.overflow === "auto" || style.overflowY === "auto" || style.overflow === "scroll") return el;
    el = el.parentElement;
  }
  return null;
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { fileUrl, fileBlobUrl, fileBytes, scale = 1.25, onPagesReady, onError, renderPageOverlay, className, interactiveLinks = true },
  ref
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<PdfPageInfo[]>([]);
  const loadTokenRef = useRef(0);
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [containerKey, setContainerKey] = useState(0);
  const shouldLoadRef = useRef(false);

  // Lazy rendering refs
  const pdfRef = useRef<any>(null);
  const viewportsRef = useRef<any[]>([]);
  const renderedRef = useRef<Set<number>>(new Set());
  const pendingRef = useRef<Set<number>>(new Set());
  const placeholdersRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep refs of callback props to avoid stale closures
  const onPagesReadyRef = useRef(onPagesReady);
  onPagesReadyRef.current = onPagesReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const renderPageOverlayRef = useRef(renderPageOverlay);
  renderPageOverlayRef.current = renderPageOverlay;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const interactiveLinksRef = useRef(interactiveLinks);
  interactiveLinksRef.current = interactiveLinks;

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

  const renderPageInner = useCallback(async (
    pdf: any,
    pageNumber: number,
    vp: { width: number; height: number },
    currentScale: number
  ) => {
    if (pendingRef.current.has(pageNumber)) return;
    pendingRef.current.add(pageNumber);

    const myToken = loadTokenRef.current;

    try {
      const page = await pdf.getPage(pageNumber);
      if (loadTokenRef.current !== myToken) { pendingRef.current.delete(pageNumber); return; }

      const placeholder = placeholdersRef.current.get(pageNumber);
      if (!placeholder) { pendingRef.current.delete(pageNumber); return; }

      placeholder.replaceChildren();
      placeholder.style.background = "";
      placeholder.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
      placeholder.style.border = "1px solid var(--border, #e5e7eb)";
      placeholder.style.borderRadius = "";

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      canvas.style.display = "block";
      canvas.style.pointerEvents = "none";

      const overlay = document.createElement("div");
      overlay.dataset.overlay = "true";
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";

      let linksLayer: HTMLDivElement | null = null;
      if (interactiveLinksRef.current) {
        linksLayer = document.createElement("div");
        linksLayer.style.position = "absolute";
        linksLayer.style.inset = "0";
        linksLayer.style.pointerEvents = "none";
      }

      placeholder.appendChild(canvas);
      if (linksLayer) placeholder.appendChild(linksLayer);
      placeholder.appendChild(overlay);

      if (loadTokenRef.current !== myToken) { pendingRef.current.delete(pageNumber); return; }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: vp as any, canvas }).promise;
      }

      if (loadTokenRef.current !== myToken) { pendingRef.current.delete(pageNumber); return; }

      // Text layer
      const { TextLayerBuilder } = await import("pdfjs-dist/web/pdf_viewer.mjs");
      const textLayerDiv = document.createElement("div");
      textLayerDiv.style.position = "absolute";
      textLayerDiv.style.inset = "0";
      textLayerDiv.style.width = `${vp.width}px`;
      textLayerDiv.style.height = `${vp.height}px`;
      textLayerDiv.style.overflow = "hidden";
      textLayerDiv.style.userSelect = "text";
      textLayerDiv.style.pointerEvents = "auto";
      textLayerDiv.style.color = "transparent";
      textLayerDiv.style.zIndex = "2";
      placeholder.appendChild(textLayerDiv);

      const textLayerBuilder = new TextLayerBuilder({
        pdfPage: page,
        onAppend: (div: HTMLDivElement) => {
          div.style.position = "absolute";
          div.style.inset = "0";
          div.style.width = `${vp.width}px`;
          div.style.height = `${vp.height}px`;
          div.style.textAlign = "initial";
          div.style.overflow = "hidden";
          div.style.userSelect = "text";
          div.style.pointerEvents = "auto";
          div.style.color = "transparent";
          div.style.zIndex = "2";
          placeholder.appendChild(div);
        },
      });
      await textLayerBuilder.render({ viewport: vp as any, images: null as any });

      if (loadTokenRef.current !== myToken) { pendingRef.current.delete(pageNumber); return; }

      // Links
      const links: PdfPageInfo["links"] = [];

      if (interactiveLinksRef.current && linksLayer) {
        const annotations = await page.getAnnotations();
        if (Array.isArray(annotations)) {
          for (const annotation of annotations) {
            if (annotation.subtype === "Link" && annotation.rect) {
              const [x1, y1, x2, y2] = annotation.rect;
              const vp2 = (vp as any).convertToViewportRectangle
                ? (vp as any).convertToViewportRectangle([x1, y1, x2, y2])
                : [x1, y1, x2, y2];
              const [vpX1, vpY1, vpX2, vpY2] = vp2;

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
                linkEl.href = url;
                linkEl.target = "_blank";
                linkEl.rel = "noopener noreferrer";
              } else if (dest) {
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
                  } catch {}
                });
              }

              linksLayer.appendChild(linkEl);
              links.push({ rect: [vpX1, vpY1, vpX2, vpY2], url, dest });
            }
          }
        }
      }

      renderedRef.current.add(pageNumber);
      pendingRef.current.delete(pageNumber);

      const pageInfo: PdfPageInfo = {
        pageNumber,
        width: vp.width,
        height: vp.height,
        container: overlay,
        links,
      };

      const currentPages = [...pagesRef.current];
      const idx = currentPages.findIndex((p) => p.pageNumber === pageNumber);
      if (idx >= 0) {
        currentPages[idx] = pageInfo;
      } else {
        currentPages.push(pageInfo);
      }
      pagesRef.current = currentPages;

      if (renderPageOverlayRef.current) {
        setPages([...currentPages]);
      }

      onPagesReadyRef.current?.(currentPages);
    } catch (error) {
      pendingRef.current.delete(pageNumber);
      console.error(`[v0] render page ${pageNumber} failed`, error);
    }
  }, []);

  const checkVisiblePages = useCallback(() => {
    if (!pdfRef.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const buffer = 400;

    for (const [pageNum, placeholder] of placeholdersRef.current) {
      if (renderedRef.current.has(pageNum) || pendingRef.current.has(pageNum)) continue;

      const rect = placeholder.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;

      if (relativeTop < containerHeight + buffer && relativeTop + rect.height > -buffer) {
        const vp = viewportsRef.current[pageNum - 1];
        if (vp) {
          renderPageInner(pdfRef.current, pageNum, vp, scaleRef.current);
        }
      }
    }
  }, [renderPageInner]);

  const scheduleCheck = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      checkVisiblePages();
    });
  }, [checkVisiblePages]);

  const load = async () => {
    const myLoadToken = ++loadTokenRef.current;

    // Cleanup previous state
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pdfRef.current) {
      try { (pdfRef.current as any).destroy?.(); } catch {}
      pdfRef.current = null;
    }
    renderedRef.current.clear();
    pendingRef.current.clear();
    placeholdersRef.current.clear();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.removeEventListener("scroll", scheduleCheck);
      scrollContainerRef.current = null;
    }

    pagesRef.current = [];
    setPages([]);
    setLoading(true);
    setErrorMessage(null);

    if (!rootRef.current) return;
    if (loadTokenRef.current !== myLoadToken) return;

    try {
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

      const pdfjs = await getPdfJs();
      if (loadTokenRef.current !== myLoadToken) return;

      const loadingTask = pdfjs.getDocument(source as Parameters<typeof pdfjs.getDocument>[0]);
      const pdf = await loadingTask.promise;

      if (loadTokenRef.current !== myLoadToken) {
        try { loadingTask.destroy?.(); } catch {}
        return;
      }

      pdfRef.current = pdf;

      // Get viewport dimensions for all pages (metadata only, no rendering)
      const viewports: any[] = [];
      const metaPages: PdfPageInfo[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        if (loadTokenRef.current !== myLoadToken) break;
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale });
        viewports.push(vp);
        metaPages.push({
          pageNumber: i,
          width: vp.width,
          height: vp.height,
          container: document.createElement("div"),
          links: [],
        });
      }

      if (loadTokenRef.current !== myLoadToken) return;
      viewportsRef.current = viewports;

      // Create placeholder divs for all pages
      for (let i = 0; i < viewports.length; i++) {
        const pageNumber = i + 1;
        const vp = viewports[i];

        const ph = document.createElement("div");
        ph.dataset.pageNumber = String(pageNumber);
        ph.style.width = `${vp.width}px`;
        ph.style.height = `${vp.height}px`;
        ph.style.margin = "0 auto 16px auto";
        ph.style.background = "#f0f0f0";
        ph.style.borderRadius = "4px";
        ph.style.position = "relative";
        ph.style.overflow = "hidden";
        ph.style.transition = "background 0.2s";

        rootRef.current.appendChild(ph);
        placeholdersRef.current.set(pageNumber, ph);
      }

      pagesRef.current = metaPages;

      // Set up scroll detection on the nearest scrollable parent
      const scrollContainer = findScrollableParent(rootRef.current);
      if (scrollContainer) {
        scrollContainerRef.current = scrollContainer;
        scrollContainer.addEventListener("scroll", scheduleCheck, { passive: true });
      }

      setLoading(false);
      onPagesReadyRef.current?.(metaPages);

      // Initial render of visible pages
      scheduleCheck();
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Falha a carregar PDF");
      setErrorMessage(err.message);
      setLoading(false);
      onErrorRef.current?.(err);
    }
  };

  useEffect(() => {
    shouldLoadRef.current = true;
    setContainerKey(k => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, fileBlobUrl, fileBytes, scale]);

  useEffect(() => {
    if (!shouldLoadRef.current) return;
    shouldLoadRef.current = false;
    void load();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.removeEventListener("scroll", scheduleCheck);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerKey]);

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
      <div key={containerKey} ref={rootRef} className="mx-auto w-fit" />
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">A carregar PDF...</p>
      ) : null}
      {errorMessage ? (
        <p className="py-6 text-center text-sm text-destructive">{errorMessage}</p>
      ) : null}
      {!loading && !errorMessage && pages.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum ficheiro disponível para pré-visualização.
        </p>
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
