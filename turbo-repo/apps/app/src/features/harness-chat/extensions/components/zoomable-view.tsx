"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
  type RefObject,
} from "react";
import {
  HiArrowsPointingIn,
  HiMagnifyingGlassMinus,
  HiMagnifyingGlassPlus,
} from "react-icons/hi2";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";

export interface Size {
  width: number;
  height: number;
}

/** Content is drawn at `scale`, its top-left corner at (`x`, `y`) in the box. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const STEP = 1.25;
const FIT_PADDING = 16;

const clamp = (scale: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** `view` scaled by `factor`, keeping the content under `at` where it is. */
export function zoomAround(view: View, factor: number, at: Point): View {
  const scale = clamp(view.scale * factor);
  const ratio = scale / view.scale;
  return {
    scale,
    x: at.x - (at.x - view.x) * ratio,
    y: at.y - (at.y - view.y) * ratio,
  };
}

/** The whole of `content` centered in `box`, never enlarged. */
export function fitView(content: Size, box: Size): View {
  const scale = clamp(
    Math.min(
      1,
      (box.width - 2 * FIT_PADDING) / content.width,
      (box.height - 2 * FIT_PADDING) / content.height
    )
  );
  return {
    scale,
    x: (box.width - content.width * scale) / 2,
    y: (box.height - content.height * scale) / 2,
  };
}

const positive = (value: string | null): number | null => {
  const n = value === null ? Number.NaN : Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The drawing size of an `<svg>`: its viewBox, else its width and height
 * when given in pixels. */
export function svgElementSize(svg: Element): Size | null {
  const box = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) {
    return { width: box[2], height: box[3] };
  }
  const px = (name: string) => {
    const raw = svg.getAttribute(name);
    return raw && /^[\d.]+(px)?$/.test(raw.trim()) ? positive(raw) : null;
  };
  const width = px("width");
  const height = px("height");
  return width && height ? { width, height } : null;
}

export function svgMarkupSize(markup: string): Size | null {
  const svg = new DOMParser()
    .parseFromString(markup, "image/svg+xml")
    .querySelector("svg");
  return svg ? svgElementSize(svg) : null;
}

/** Makes the drawing (an `<img>`, or a Mermaid diagram's `<svg>`) fill a
 * wrapper set to its own size. */
export const FILL_DRAWING =
  "[&>img]:h-full [&>img]:w-full [&>img]:max-w-none [&>div>svg]:h-auto! [&>div>svg]:w-full! [&>div>svg]:max-w-none!";

/** `size` when given, else the size of the first `<svg>` under `ref`,
 * followed as it renders. */
export function useDrawingSize(
  ref: RefObject<HTMLElement | null>,
  size?: Size | null
): Size | null {
  const [found, setFound] = useState<Size | null>(null);
  useEffect(() => {
    const content = ref.current;
    if (size || !content) return;
    const read = () => {
      const svg = content.querySelector("svg");
      const next = svg ? svgElementSize(svg) : null;
      setFound((prev) =>
        prev && next?.width === prev.width && next.height === prev.height
          ? prev
          : next
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, size]);
  return size ?? found;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const pan = (view: View, from: Point, to: Point): View => ({
  ...view,
  x: view.x + to.x - from.x,
  y: view.y + to.y - from.y,
});

/** One of two fingers moved from `from` to `to`: zoom by the change in
 * their spread and follow their midpoint. */
function pinch(view: View, from: Point, to: Point, other: Point): View {
  const before = middle(from, other);
  const after = middle(to, other);
  const factor = distance(to, other) / (distance(from, other) || 1);
  return pan(zoomAround(view, factor, before), before, after);
}

const buttonClass =
  "rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white";

/**
 * Pan and zoom over a drawing: wheel or pinch zooms around the pointer,
 * dragging pans, double-click zooms in, and +, - and 0 (fit) work from the
 * keyboard. `size` is the drawing's own size; without it, it is read from the
 * first `<svg>` the children render.
 */
export const ZoomableView: FC<{
  size?: Size | null;
  className?: string;
  children: ReactNode;
}> = ({ size, className, children }) => {
  const tr = useHarnessChatTr();
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const moved = useRef(false);
  const natural = useDrawingSize(contentRef, size);

  const boxSize = useCallback((): Size | null => {
    const box = boxRef.current;
    if (!box?.clientWidth || !box.clientHeight) return null;
    return { width: box.clientWidth, height: box.clientHeight };
  }, []);

  const fit = useCallback(() => {
    const box = boxSize();
    if (natural && box) setView(fitView(natural, box));
  }, [natural, boxSize]);

  const refit = useCallback(() => {
    moved.current = false;
    fit();
  }, [fit]);

  useEffect(() => {
    if (!moved.current) fit();
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!moved.current) fit();
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit]);

  const center = useCallback((): Point => {
    const box = boxSize();
    return box ? { x: box.width / 2, y: box.height / 2 } : { x: 0, y: 0 };
  }, [boxSize]);

  const zoomBy = useCallback((factor: number, at: Point) => {
    moved.current = true;
    setView((v) => zoomAround(v, factor, at));
  }, []);

  // Native listeners: React's wheel listener is passive and could not stop
  // the page from scrolling. Keys work anywhere while the view is open.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const pointers = new Map<number, Point>();
    const local = (event: MouseEvent): Point => {
      const rect = box.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const perLine = event.deltaMode === 1 ? 20 : 1;
      zoomBy(Math.exp(-event.deltaY * perLine * 0.002), local(event));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      box.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, local(event));
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const point = local(event);
      const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
      pointers.set(event.pointerId, point);
      moved.current = true;
      setView((v) =>
        other ? pinch(v, previous, point, other) : pan(v, previous, point)
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
    };
    const onDoubleClick = (event: MouseEvent) => zoomBy(2, local(event));
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (event.key === "+" || event.key === "=") zoomBy(STEP, center());
      else if (event.key === "-" || event.key === "_")
        zoomBy(1 / STEP, center());
      else if (event.key === "0") refit();
      else return;
      event.preventDefault();
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("pointerdown", onPointerDown);
    box.addEventListener("pointermove", onPointerMove);
    box.addEventListener("pointerup", onPointerUp);
    box.addEventListener("pointercancel", onPointerUp);
    box.addEventListener("dblclick", onDoubleClick);
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointerdown", onPointerDown);
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerup", onPointerUp);
      box.removeEventListener("pointercancel", onPointerUp);
      box.removeEventListener("dblclick", onDoubleClick);
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [zoomBy, center, refit]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={boxRef}
        data-testid="zoomable-area"
        title={tr("harnessChat.ui.showArtifact.zoomArea")}
        className="h-full w-full cursor-grab touch-none overflow-hidden rounded bg-white select-none active:cursor-grabbing"
      >
        <div
          ref={contentRef}
          data-testid="zoomable-content"
          className={`absolute top-0 left-0 origin-top-left ${FILL_DRAWING}`}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            ...(natural && { width: natural.width, height: natural.height }),
          }}
        >
          {children}
        </div>
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md border border-gray-200 bg-white/90 p-0.5 shadow-sm dark:border-gray-600 dark:bg-gray-800/90">
        <button
          type="button"
          className={buttonClass}
          title={tr("harnessChat.ui.showArtifact.zoomOut")}
          aria-label={tr("harnessChat.ui.showArtifact.zoomOut")}
          onClick={() => zoomBy(1 / STEP, center())}
        >
          <HiMagnifyingGlassMinus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs text-gray-600 tabular-nums dark:text-gray-300">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          className={buttonClass}
          title={tr("harnessChat.ui.showArtifact.zoomIn")}
          aria-label={tr("harnessChat.ui.showArtifact.zoomIn")}
          onClick={() => zoomBy(STEP, center())}
        >
          <HiMagnifyingGlassPlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={buttonClass}
          title={tr("harnessChat.ui.showArtifact.fit")}
          aria-label={tr("harnessChat.ui.showArtifact.fit")}
          onClick={refit}
        >
          <HiArrowsPointingIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`${buttonClass} text-xs`}
          title={tr("harnessChat.ui.showArtifact.actualSize")}
          aria-label={tr("harnessChat.ui.showArtifact.actualSize")}
          onClick={() => {
            moved.current = true;
            const at = center();
            setView((v) => zoomAround(v, 1 / v.scale, at));
          }}
        >
          1:1
        </button>
      </div>
    </div>
  );
};
