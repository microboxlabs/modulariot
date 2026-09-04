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
import { useContainerWidth } from "../use-container-width";

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

/** One entry in the flattened outline (PDF "bookmarks") — `level` is depth
 * in the original tree, used to indent the sections list. `yFraction` (0 =
 * top of its page, 1 = bottom) is the *baseline* of the heading, in the
 * same bottom-up convention text runs use — what tells two sections on the
 * same page apart when jumping to one or tracking scroll position, since
 * "page" alone can't distinguish them. `heightFraction` is the heading's
 * own glyph height, in that same page-relative scale — scrolling to just
 * the baseline would still crop the top of a tall heading behind the
 * viewport's edge, so callers subtract this to land above the whole line
 * instead of through the middle of it. */
interface OutlineEntry {
  readonly title: string;
  readonly page: number;
  readonly level: number;
  readonly yFraction: number;
  readonly heightFraction: number;
}

/** Loose shape of a pdf.js outline node — typed locally rather than pulled
 * from pdfjs-dist (whose OutlineNode isn't exported), since only `title`,
 * `dest`, and `items` are actually read here. */
interface RawOutlineNode {
  readonly title: string;
  readonly dest: string | unknown[] | null;
  readonly items?: readonly RawOutlineNode[];
}

/** Depth-first flatten of the outline tree into page-numbered entries.
 * Skips nodes whose destination can't be resolved to a page (malformed or
 * unsupported dest shapes) rather than failing the whole outline. */
async function flattenOutline(
  pdf: PDFDocumentProxy,
  nodes: readonly RawOutlineNode[],
  level = 0
): Promise<OutlineEntry[]> {
  const entries: OutlineEntry[] = [];
  for (const node of nodes) {
    try {
      const dest =
        typeof node.dest === "string" ? await pdf.getDestination(node.dest) : node.dest;
      const ref = Array.isArray(dest) ? dest[0] : null;
      if (ref != null) {
        const pageIndex = await pdf.getPageIndex(ref);
        // A "XYZ" dest is `[ref, {name:"XYZ"}, left, top, zoom]` — `top` is
        // the same bottom-up PDF-space y that text runs use. Other dest
        // types (Fit, FitH, …) don't carry one; those entries just jump to
        // the top of the page instead of a specific spot on it.
        const top = Array.isArray(dest) && typeof dest[3] === "number" ? dest[3] : null;
        let yFraction = 0;
        if (top != null) {
          const page = await pdf.getPage(pageIndex + 1);
          const pageHeight = page.getViewport({ scale: 1 }).height;
          if (pageHeight > 0) yFraction = Math.min(1, Math.max(0, 1 - top / pageHeight));
        }
        // Real bookmarks don't carry a font size, so there's nothing to
        // subtract here — the PDF author's own `top` is trusted as-is.
        entries.push({ title: node.title, page: pageIndex + 1, level, yFraction, heightFraction: 0 });
      }
    } catch {
      // Unresolvable destination — skip this node, keep the rest.
    }
    if (node.items?.length) {
      entries.push(...(await flattenOutline(pdf, node.items, level + 1)));
    }
  }
  return entries;
}

interface TextLine {
  readonly page: number;
  readonly height: number;
  readonly text: string;
  readonly yFraction: number;
  readonly heightFraction: number;
}

/** Groups one page's text runs into lines by baseline — a heading and the
 * body text wrapped near it still land on separate lines this way, even
 * though `getTextContent()` hands them back as a flat run list. Rounds `y`
 * to a small bucket to absorb sub-pixel jitter between runs on the same
 * baseline, and keeps the tallest glyph height seen on each line. */
async function pageLines(pdf: PDFDocumentProxy, pageNumber: number): Promise<TextLine[]> {
  const page = await pdf.getPage(pageNumber);
  const pageHeight = page.getViewport({ scale: 1 }).height;
  const { items } = await page.getTextContent();
  const byY = new Map<number, { text: string; height: number }>();
  for (const item of items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 2) * 2;
    const existing = byY.get(y);
    if (existing) {
      existing.text += item.str;
      existing.height = Math.max(existing.height, item.height);
    } else {
      byY.set(y, { text: item.str, height: item.height });
    }
  }
  return [...byY.entries()]
    .map(([y, v]) => ({
      page: pageNumber,
      height: v.height,
      text: v.text.trim(),
      // PDF y grows upward from the page's bottom edge — flip it to "how
      // far down from the top", same convention flattenOutline's dest-based
      // yFraction uses.
      yFraction: pageHeight > 0 ? Math.min(1, Math.max(0, 1 - y / pageHeight)) : 0,
      heightFraction: pageHeight > 0 ? v.height / pageHeight : 0,
    }))
    .filter((line) => line.text.length > 0)
    .sort((a, b) => a.yFraction - b.yFraction); // top of page first.
}

/**
 * Fallback "sections" for PDFs with no embedded outline — the common case,
 * since an outline only exists if whatever authored the PDF explicitly
 * added bookmarks. Reads each page's actual text and treats visually
 * larger lines as headings, the same way a reader would eyeball a title:
 * the most common line height is taken as body text, and any line
 * noticeably taller than that becomes a heading. Distinct heading sizes
 * become outline depths (bigger text = shallower level), same as a real
 * outline's nesting would.
 */
async function detectSectionsFromText(
  pdf: PDFDocumentProxy,
  numPages: number
): Promise<OutlineEntry[]> {
  const lines: TextLine[] = [];
  for (let p = 1; p <= numPages; p++) {
    lines.push(...(await pageLines(pdf, p)));
  }
  if (lines.length === 0) return [];

  const heightCounts = new Map<number, number>();
  for (const line of lines) heightCounts.set(line.height, (heightCounts.get(line.height) ?? 0) + 1);
  const [bodySize] = [...heightCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const headingSizes = [
    ...new Set(lines.filter((line) => line.height > bodySize * 1.15).map((line) => line.height)),
  ].sort((a, b) => b - a);
  if (headingSizes.length === 0) return [];

  return lines
    .filter((line) => headingSizes.includes(line.height))
    .map((line) => ({
      title: line.text,
      page: line.page,
      level: headingSizes.indexOf(line.height),
      yFraction: line.yFraction,
      heightFraction: line.heightFraction,
    }));
}

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

/** One entry in the side rail's "Pages" tab — same card-with-footer-strip
 * styling as the PPT previewer's slide rail (previewers/ppt/ppt-previewer.tsx),
 * just rendering a lazily-drawn pdf.js canvas instead of a slide layout. */
function PdfThumbnail({
  pdf,
  pageNumber,
  width,
  active,
  onSelect,
}: {
  readonly pdf: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly width: number;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedWidthRef = useRef(0);
  const [rendered, setRendered] = useState(false);

  // Renders as soon as a real width is known — eagerly, not lazily on
  // scroll: an IntersectionObserver scoped to the rail's own scroll
  // container turned out to be the difference between "shows the actual
  // page" and a row of blank boxes (root-resolution/timing is fiddly;
  // thumbnails are cheap enough to just draw them all up front).
  useEffect(() => {
    if (width <= 0 || renderedWidthRef.current === width) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = width / unscaled.width;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
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
        if (cancelled) return;
        renderedWidthRef.current = width;
        setRendered(true);
      } catch {
        /* cancelled mid-render (width changed again) — the next effect pass redraws */
      }
    })();

    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [pdf, pageNumber, width]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={`flex w-full shrink-0 flex-col overflow-hidden rounded-lg border transition-colors ${
        active
          ? "border-blue-500"
          : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
      }`}
    >
      <div
        className="flex w-full items-center justify-center overflow-hidden bg-white dark:bg-gray-950"
        // A4-ish placeholder ratio so the box has real size (and the layout
        // doesn't jump) before the first render lands.
        style={rendered ? undefined : { aspectRatio: "3 / 4" }}
      >
        <canvas ref={canvasRef} className="block bg-white" />
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-2 py-1 text-left text-[11px] tabular-nums text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {pageNumber}
      </div>
    </button>
  );
}

type RailMode = "page" | "section";

/**
 * Custom PDF viewer built on pdf.js (pdfjs-dist): pages render to canvases in
 * a themed scroll area with a floating toolbar (page position, page step,
 * zoom), replacing the browser's native `<iframe src="file.pdf">` chrome so
 * it matches the rest of the storytelling previewers. A side rail — styled
 * like the PPT previewer's slide rail — lists either page thumbnails or the
 * document's outline (its section titles), toggled at the rail's top; the
 * section tab only appears for PDFs that actually carry an outline.
 */
export function PdfPreviewer({ title, dict, onReadyChange }: PdfPreviewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const { ref: railRef, width: railWidth } = useContainerWidth<HTMLDivElement>();

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [failed, setFailed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(0);
  const [sections, setSections] = useState<OutlineEntry[] | null>(null);
  const [railMode, setRailMode] = useState<RailMode>("page");

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

        // "Section" view: prefer the PDF's own outline (bookmarks) when it
        // has one; most don't, so fall back to guessing headings from the
        // page text itself (see detectSectionsFromText) — and only fall
        // back to hiding the tab entirely if that comes up empty too.
        let resolved: OutlineEntry[] = [];
        const outline = await doc.getOutline().catch(() => null);
        if (outline && outline.length > 0) {
          resolved = await flattenOutline(doc, outline as RawOutlineNode[]);
        }
        if (resolved.length === 0) {
          resolved = await detectSectionsFromText(doc, doc.numPages).catch(() => []);
        }
        if (!cancelled && resolved.length > 0) setSections(resolved);
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

  // Track which page is most in view for the toolbar's position indicator
  // and the rail's active thumbnail/section.
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

  // A section's absolute scroll offset: its page's own offset within the
  // scroll container, plus how far down that page it sits (yFraction × the
  // page's current on-screen height, so this stays correct across zoom
  // levels without needing to know the page's unscaled size here) — minus
  // its own height, since yFraction marks the text's *baseline* and landing
  // there would still crop the top of the heading behind the viewport's
  // edge. A little extra breathing room on top of that.
  const sectionScrollTop = useCallback((section: OutlineEntry): number | null => {
    const container = scrollRef.current;
    const pageEl = pageEls.current.get(section.page);
    if (!container || !pageEl) return null;
    const containerRect = container.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    const pageTop = pageRect.top - containerRect.top + container.scrollTop;
    const baseline = pageTop + section.yFraction * pageEl.offsetHeight;
    const lineHeight = section.heightFraction * pageEl.offsetHeight;
    return baseline - lineHeight - 12;
  }, []);

  const goToSection = useCallback(
    (section: OutlineEntry, index: number) => {
      const container = scrollRef.current;
      const top = sectionScrollTop(section);
      if (!container || top === null) return;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      // Pin the highlight to the clicked entry immediately — don't wait for
      // the smooth-scroll to finish and the scrollspy below to catch up.
      setActiveSectionIndex(index);
    },
    [sectionScrollTop]
  );

  // Scrollspy for the sections list: which section the reader has actually
  // scrolled to, tracked continuously (not just which *page* is current —
  // several sections commonly share one page, so page alone can't tell them
  // apart). Re-picks the last section whose computed top has scrolled past.
  const [activeSectionIndex, setActiveSectionIndex] = useState(-1);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !sections || sections.length === 0) return;

    const recompute = () => {
      const scrollTop = container.scrollTop;
      let best = 0;
      for (let i = 0; i < sections.length; i++) {
        const top = sectionScrollTop(sections[i]);
        // 48px lookahead: a heading counts as "current" a little before it
        // literally reaches the top of the viewport, like a scrollspy.
        if (top !== null && top <= scrollTop + 48) best = i;
      }
      setActiveSectionIndex(best);
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    };
    recompute();
    container.addEventListener("scroll", onScroll);
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
    // Re-measure whenever the pages might have reflowed (page count, zoom)
    // or the section list itself changed.
  }, [sections, scale, numPages, sectionScrollTop]);

  const changeZoom = useCallback((delta: number) => {
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 100) / 100))
    );
  }, []);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-100 p-6 text-center dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("detail.pdf.error", dict)}
        </p>
      </div>
    );
  }

  const showRail = pdf && numPages > 1;
  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-2 py-1 text-center text-xs font-medium transition-colors ${
      active
        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    }`;

  return (
    <div className="flex h-full w-full min-h-0 flex-1">
      {showRail && (
        <div className="flex w-44 shrink-0 flex-col border-r border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-950">
          <div className="flex gap-1 p-2">
            <button type="button" onClick={() => setRailMode("page")} className={tabClass(railMode === "page")}>
              {tr("detail.pdf.railPages", dict)}
            </button>
            <button
              type="button"
              onClick={() => sections && setRailMode("section")}
              disabled={!sections}
              title={sections ? undefined : tr("detail.pdf.noSections", dict)}
              className={`${tabClass(railMode === "section")} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {tr("detail.pdf.railSections", dict)}
            </button>
          </div>

          <div ref={railRef} className="flex-1 overflow-y-auto p-3">
            {railMode === "page" || !sections ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: numPages }, (_, i) => (
                  <PdfThumbnail
                    key={i + 1}
                    pdf={pdf}
                    pageNumber={i + 1}
                    width={railWidth}
                    active={i + 1 === currentPage}
                    onSelect={() => goToPage(i + 1)}
                  />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {sections.map((section, i) => (
                  <li key={`${section.page}-${i}`}>
                    <button
                      type="button"
                      onClick={() => goToSection(section, i)}
                      style={{ paddingLeft: `${0.5 + section.level * 0.75}rem` }}
                      className={`block w-full truncate rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${
                        i === activeSectionIndex
                          ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                      title={section.title}
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-gray-100 dark:bg-gray-950">
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
    </div>
  );
}
