"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { clearSearchHighlights, focusSearchMatch, searchInDom } from "../../../dom-search";
import type { DeckContent, DeckSlide } from "../../../storytelling.types";
import type { SearchableHandle } from "../searchable";

interface PptPreviewerProps {
  readonly deck: DeckContent;
  /** Lets the header know when the search box can accept input. Deck
   * content is a prop, not fetched, so this is ready as soon as it mounts —
   * unlike Html/MarkdownPreviewer there's no async load to wait on. */
  readonly onReadyChange?: (ready: boolean) => void;
}

function TitleSlide({ slide }: { readonly slide: Extract<DeckSlide, { type: "title" }> }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-gray-900 px-16">
      <h1 className="text-5xl font-bold text-white">{slide.title}</h1>
      {slide.subtitle && <p className="mt-4 text-lg text-gray-400">{slide.subtitle}</p>}
    </div>
  );
}

function BulletsSlide({ slide }: { readonly slide: Extract<DeckSlide, { type: "bullets" }> }) {
  return (
    <div className="flex h-full w-full flex-col bg-white px-16 py-14 dark:bg-gray-900">
      <h2 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">{slide.title}</h2>
      <ul className="flex flex-col gap-4">
        {slide.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-xl text-gray-700 dark:text-gray-300">
            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableSlide({ slide }: { readonly slide: Extract<DeckSlide, { type: "table" }> }) {
  return (
    <div className="flex h-full w-full flex-col bg-white px-16 py-14 dark:bg-gray-900">
      <h2 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">{slide.title}</h2>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {slide.headers.map((h) => (
              <th key={h} className="bg-gray-100 px-3 py-2 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slide.rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-gray-100 dark:border-gray-800">
              {row.map((cell, i) => (
                <td key={slide.headers[i] ?? i} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlideBody({ slide }: { readonly slide: DeckSlide }) {
  if (slide.type === "title") return <TitleSlide slide={slide} />;
  if (slide.type === "bullets") return <BulletsSlide slide={slide} />;
  return <TableSlide slide={slide} />;
}

// Every slide renders at a fixed 960×540 "design size" and gets scaled down
// with a CSS transform to fit whatever box it's actually given — same
// technique presentation software itself uses for slide panels. Content
// (headings, padding, everything) scales together as one unit, so it never
// overflows or clips at a narrow width the way plain responsive text
// sizing would; it just shrinks proportionally instead.
const CANVAS_W = 960;
const CANVAS_H = 540;

/** Tracks an element's own content-box width so a canvas can be scaled to
 * exactly fill it — ResizeObserver's contentRect already excludes padding,
 * so this is the true space available to a `w-full` child. */
function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function ScaledCanvas({ slide, width }: { readonly slide: DeckSlide; readonly width: number }) {
  const scale = width > 0 ? width / CANVAS_W : 0;
  return (
    <div
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        visibility: scale > 0 ? "visible" : "hidden",
      }}
    >
      <SlideBody slide={slide} />
    </div>
  );
}

function SlideThumbnail({
  slide,
  index,
  active,
  width,
  onSelect,
}: {
  readonly slide: DeckSlide;
  readonly index: number;
  readonly active: boolean;
  readonly width: number;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Slide ${index + 1}`}
      aria-current={active}
      className={`flex w-full shrink-0 flex-col overflow-hidden rounded-lg border transition-colors ${
        active
          ? "border-blue-500"
          : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-white dark:bg-gray-950">
        <ScaledCanvas slide={slide} width={width} />
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-2 py-1 text-left text-[11px] tabular-nums text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {index + 1}
      </div>
    </button>
  );
}

// --- Search: matches can be on slides other than the one currently on
// screen (only the active slide + tiny scaled-down thumbnails exist in the
// DOM at once, and thumbnails are deliberately excluded from search so we
// never highlight illegible text inside them) — so search works off the
// structured DeckContent, not the DOM, to know which slide to jump to and
// what "3 / 12" means. Highlighting the actual match, though, still has to
// happen in the DOM, and only once the target slide has actually mounted.

function slideText(slide: DeckSlide): string[] {
  if (slide.type === "title") return [slide.title, slide.subtitle ?? ""];
  if (slide.type === "bullets") return [slide.title, ...slide.items];
  return [slide.title, ...slide.headers, ...slide.rows.flat()];
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  const lower = text.toLowerCase();
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = lower.indexOf(needle, idx + needle.length);
  }
  return count;
}

function matchesPerSlide(slides: readonly DeckSlide[], needle: string): number[] {
  return slides.map((slide) =>
    slideText(slide).reduce((sum, text) => sum + countOccurrences(text, needle), 0)
  );
}

/** Which slide a global (whole-deck) match index falls on, and its index
 * within that slide — slideText()'s field order matches each slide
 * component's actual DOM order, so this lines up with what searchInDom's
 * TreeWalker finds once that slide is mounted. */
function locateMatch(
  counts: number[],
  globalIndex: number
): { slideIndex: number; localIndex: number } | null {
  let remaining = globalIndex;
  for (let i = 0; i < counts.length; i++) {
    if (remaining < counts[i]) return { slideIndex: i, localIndex: remaining };
    remaining -= counts[i];
  }
  return null;
}

/**
 * Renders a "ppt" story's actual content, structured slide-by-slide — same
 * DeckContent build-pptx.ts turns into a real .pptx on download, so preview
 * and download can't drift apart. Replaces the earlier PDF-rendered stand-in
 * now that there's real per-story content to render directly.
 */
export const PptPreviewer = forwardRef<SearchableHandle, PptPreviewerProps>(
  function PptPreviewer({ deck, onReadyChange }, ref) {
    const [index, setIndex] = useState(0);
    const slide = deck.slides[index];

    useEffect(() => {
      onReadyChange?.(true);
      // Fires once on mount — onReadyChange is expected to be a stable
      // callback (story-detail-page.tsx passes a useState setter directly).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const count = deck.slides.length;

    const { ref: railRef, width: railWidth } = useContainerWidth<HTMLDivElement>();
    const { ref: mainFrameRef, width: mainFrameWidth } = useContainerWidth<HTMLDivElement>();

    const queryRef = useRef("");
    const countsRef = useRef<number[]>([]);
    const globalIndexRef = useRef(0);
    // Bumped on every search()/stepMatch() call so the highlight effect below
    // re-runs even when the target slide is already the active one (index
    // itself wouldn't change, so it alone can't be the effect's only trigger).
    const [focusToken, setFocusToken] = useState(0);

    useEffect(() => {
      const el = mainFrameRef.current;
      if (!el) return;
      const query = queryRef.current;
      if (!query.trim()) {
        clearSearchHighlights(el);
        return;
      }
      searchInDom(el, query);
      const target = locateMatch(countsRef.current, globalIndexRef.current);
      if (target?.slideIndex === index) {
        focusSearchMatch(el, target.localIndex, { scroll: false });
      }
      // mainFrameRef is a stable ref object, deliberately not a dependency.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, focusToken]);

    useImperativeHandle(
      ref,
      () => ({
        search(query: string) {
          queryRef.current = query;
          const needle = query.trim().toLowerCase();
          const counts = matchesPerSlide(deck.slides, needle);
          countsRef.current = counts;
          const total = counts.reduce((a, b) => a + b, 0);
          globalIndexRef.current = 0;
          if (total > 0) {
            const target = locateMatch(counts, 0);
            if (target) setIndex(target.slideIndex);
          }
          setFocusToken((t) => t + 1);
          return total;
        },
        stepMatch(delta: number) {
          const counts = countsRef.current;
          const total = counts.reduce((a, b) => a + b, 0);
          if (total === 0) return -1;
          const next = (globalIndexRef.current + delta + total) % total;
          globalIndexRef.current = next;
          const target = locateMatch(counts, next);
          if (target) setIndex(target.slideIndex);
          setFocusToken((t) => t + 1);
          return next;
        },
      }),
      [deck]
    );

    if (!slide) return null;

    return (
      <div className="flex h-full w-full bg-gray-100 dark:bg-gray-950">
        {count > 1 && (
          <div
            ref={railRef}
            className="flex w-44 shrink-0 flex-col gap-3 overflow-y-auto border-r border-gray-200 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-950"
          >
            {deck.slides.map((s, i) => (
              <SlideThumbnail
                key={`${s.type}-${s.title}`}
                slide={s}
                index={i}
                active={i === index}
                width={railWidth}
                onSelect={() => setIndex(i)}
              />
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={mainFrameRef}
            className="mx-auto my-auto aspect-video w-full max-w-4xl overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-700"
          >
            <ScaledCanvas slide={slide} width={mainFrameWidth} />
          </div>
          {count > 1 && (
            <div className="flex items-center justify-center gap-4 pb-4">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                aria-label="Previous slide"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <HiChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
                disabled={index === count - 1}
                aria-label="Next slide"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <HiChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);
