"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  HiArrowsPointingOut,
  HiChevronDown,
  HiChevronUp,
  HiMagnifyingGlassMinus,
  HiMagnifyingGlassPlus,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH;
export const PDF_PREVIEW_URL = `${base_path ?? ""}/api/storytelling/pdf-preview`;
export const PDF_DOWNLOAD_FILENAME = "audit-report-demo.pdf";
// Served straight from public/ — the `sync-pdf-worker` npm script (run by
// the build) keeps this file matched to the installed pdfjs-dist, so the
// worker URL never depends on bundler-specific asset resolution.
const PDF_WORKER_URL = `${base_path ?? ""}/pdf.worker.min.mjs`;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;
// px of slack subtracted from the frame width when fitting a page to it.
const FIT_PADDING = 24;
// Cap for fit-to-width so pages don't stretch across very wide screens.
const MAX_FIT_WIDTH = 900;

type RenderTask = { readonly promise: Promise<void>; cancel: () => void };

interface PdfPreviewerProps {
  readonly title: string;
  readonly dict: I18nRecord;
  /** Same readiness contract the other previewers use — PDF has no
   * find-in-page yet, but kept optional for when it gets one. */
  readonly onReadyChange?: (ready: boolean) => void;
}

/** One page: renders to a canvas the first time it scrolls near the viewport
 * and re-renders whenever the zoom changes. Holds a tall placeholder until
 * its first paint so the scrollbar and page-position indicator behave. */
function PdfPage({
  pdf,
  pageNumber,
  scale,
  registerRef,
}: {
  readonly pdf: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly scale: number;
  readonly registerRef: (pageNumber: number, el: HTMLDivElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const renderedScaleRef = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    const draw = async () => {
      if (cancelled || renderedScaleRef.current === scale) return;
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      }) as RenderTask;
      try {
        await task.promise;
        renderedScaleRef.current = scale;
        setRendered(true);
      } catch {
        // cancelled mid-render (zoom changed) — the next pass redraws
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void draw();
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(wrap);
    return () => {
      cancelled = true;
      io.disconnect();
      try {
        task?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [pdf, pageNumber, scale]);

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        registerRef(pageNumber, el);
      }}
      data-page={pageNumber}
      className={`shrink-0 shadow-md ring-1 ring-black/5 dark:ring-white/10 ${
        rendered ? "w-fit" : "min-h-[60vh] w-full max-w-3xl"
      }`}
    >
      <canvas ref={canvasRef} className="block bg-white" />
    </div>
  );
}

/**
 * Custom PDF viewer built on pdf.js (pdfjs-dist): pages render to canvases in
 * a themed scroll area with a floating toolbar (page position, page step,
 * zoom), replacing the browser's native `<iframe src="file.pdf">` chrome so
 * it matches the rest of the storytelling previewers.
 */
export function PdfPreviewer({ title, dict, onReadyChange }: PdfPreviewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [failed, setFailed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(0);

  const registerRef = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    if (el) pageEls.current.set(pageNumber, el);
    else pageEls.current.delete(pageNumber);
  }, []);

  // Load the document — pdf.js is dynamically imported so it never reaches
  // the server bundle.
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
        const res = await fetch(PDF_PREVIEW_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdf(doc);
        setNumPages(doc.numPages);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, []);

  useEffect(() => {
    if (pdf || failed) onReadyChange?.(true);
  }, [pdf, failed, onReadyChange]);

  // Fit-to-width: base scale so a page fills the frame, recomputed on resize.
  // The zoom control multiplies on top.
  useEffect(() => {
    const frame = scrollRef.current;
    if (!pdf || !frame) return;
    let cancelled = false;

    const recompute = async () => {
      const page = await pdf.getPage(1);
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });
      // Fit to the frame, but never wider than a comfortable reading column —
      // on a wide screen the page stays centered with margins rather than
      // stretching edge to edge.
      const avail = Math.min(frame.clientWidth - FIT_PADDING * 2, MAX_FIT_WIDTH);
      if (avail > 0) setFitScale(avail / unscaled.width);
    };
    void recompute();

    const ro = new ResizeObserver(() => void recompute());
    ro.observe(frame);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [pdf]);

  // Track which page is most in view for the toolbar's position indicator.
  useEffect(() => {
    const frame = scrollRef.current;
    if (!frame || numPages === 0) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const n = Number((entry.target as HTMLElement).dataset.page);
          if (entry.isIntersecting) ratios.set(n, entry.intersectionRatio);
          else ratios.delete(n);
        }
        let best = -1;
        let bestRatio = -1;
        for (const [n, r] of ratios) {
          if (r > bestRatio) {
            bestRatio = r;
            best = n;
          }
        }
        if (best > 0) setCurrentPage(best);
      },
      { root: frame, threshold: [0.1, 0.5, 0.9] }
    );
    for (const el of pageEls.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [numPages]);

  const scale = fitScale > 0 ? fitScale * zoom : zoom;

  const goToPage = useCallback((n: number) => {
    const clamped = Math.min(Math.max(n, 1), pageEls.current.size || 1);
    pageEls.current.get(clamped)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  const changeZoom = useCallback((delta: number) => {
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 100) / 100))
    );
  }, []);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-100 p-6 text-center dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("detail.pdf.error", dict)}
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 bg-gray-100 dark:bg-gray-900">
      {!pdf && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("detail.pdf.loading", dict)}
          </p>
        </div>
      )}

      <div ref={scrollRef} className="h-full w-full overflow-auto" aria-label={title}>
        {/* No top padding; bottom padding clears the floating toolbar so the
            last page isn't hidden behind it when scrolled to the end. */}
        <div className="flex min-h-full w-fit min-w-full flex-col items-center gap-6 px-6 pb-16">
          {pdf &&
            Array.from({ length: numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                pdf={pdf}
                pageNumber={i + 1}
                scale={scale}
                registerRef={registerRef}
              />
            ))}
        </div>
      </div>

      {pdf && numPages > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-gray-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={tr("detail.pdf.previousPage", dict)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiChevronUp className="h-4 w-4" />
            </button>
            <span className="min-w-14 px-1 text-center text-xs tabular-nums text-gray-600 dark:text-gray-300">
              {currentPage} / {numPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              aria-label={tr("detail.pdf.nextPage", dict)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiChevronDown className="h-4 w-4" />
            </button>

            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />

            <button
              type="button"
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label={tr("detail.pdf.zoomOut", dict)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiMagnifyingGlassMinus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label={tr("detail.pdf.zoomReset", dict)}
              className="min-w-12 rounded-lg px-1 text-center text-xs tabular-nums text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label={tr("detail.pdf.zoomIn", dict)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiMagnifyingGlassPlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label={tr("detail.pdf.fit", dict)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiArrowsPointingOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
