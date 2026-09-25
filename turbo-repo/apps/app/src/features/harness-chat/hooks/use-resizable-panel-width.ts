"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const MIN_PANEL_WIDTH_RATIO = 1 / 4; // of the viewport width
const MAX_PANEL_WIDTH_RATIO = 2 / 3; // of the viewport width
const DEFAULT_PANEL_WIDTH = 384;
const STORAGE_KEY = "harness-chat-panel-width";
/** Arrow-key nudge; Shift takes the coarser step. */
const KEYBOARD_STEP_PX = 16;
const COARSE_KEYBOARD_STEP_PX = 64;

function minPanelWidth(): number {
  return window.innerWidth * MIN_PANEL_WIDTH_RATIO;
}

function maxPanelWidth(): number {
  return window.innerWidth * MAX_PANEL_WIDTH_RATIO;
}

function clamp(width: number): number {
  return Math.min(maxPanelWidth(), Math.max(minPanelWidth(), width));
}

/**
 * Drag-to-resize state for the harness-chat panel, grabbed from a handle on
 * its left edge. Width starts at a fixed default (not read from
 * localStorage during the initial render — that would mismatch the
 * server-rendered HTML) and is restored from localStorage in an effect
 * right after mount instead, then persisted back on every change. Bounded
 * to [1/4, 2/3] of the viewport rather than fixed pixel values, so both
 * ends scale with the window and get re-clamped if it shrinks under them.
 */
export function useResizablePanelWidth() {
  const [width, setWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  // The separator needs its range as real numbers for aria-valuemin/max, and
  // both ends move with the viewport — so they're tracked as state, refreshed
  // wherever the clamping bounds themselves can change.
  const [bounds, setBounds] = useState({ min: 0, max: 0 });
  const dragStart = useRef<{ pointerX: number; startWidth: number } | null>(null);
  const capturedPointer = useRef<{ element: HTMLDivElement; pointerId: number } | null>(null);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    // The default needs clamping every bit as much as a restored value: 384px
    // is already under the 1/4 minimum on any viewport wider than 1536px, and
    // proportionally smaller the wider the window gets.
    const initial = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_PANEL_WIDTH;
    setWidth(clamp(initial));
    setBounds({ min: minPanelWidth(), max: maxPanelWidth() });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWidth((current) => clamp(current));
      setBounds({ min: minPanelWidth(), max: maxPanelWidth() });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStart.current = { pointerX: e.clientX, startWidth: width };
      // Without capture, the drag stalls wherever the pointer crosses an
      // iframe (e.g. an embedded dashboard preview) — it's a separate
      // browsing context, so it swallows pointermove/pointerup instead of
      // letting them reach the window listeners below.
      e.currentTarget.setPointerCapture(e.pointerId);
      capturedPointer.current = { element: e.currentTarget, pointerId: e.pointerId };
      setIsDragging(true);
    },
    [width],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: globalThis.PointerEvent) => {
      const start = dragStart.current;
      if (!start) return;
      // The handle sits on the panel's left edge — dragging left (negative
      // clientX delta) grows the panel, dragging right shrinks it.
      setWidth(clamp(start.startWidth + (start.pointerX - e.clientX)));
    };
    const stopDrag = () => {
      dragStart.current = null;
      setIsDragging(false);
      if (capturedPointer.current) {
        capturedPointer.current.element.releasePointerCapture(capturedPointer.current.pointerId);
        capturedPointer.current = null;
      }
    };

    // Prevents the drag from also selecting page text while the pointer
    // sweeps over the rest of the app.
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag);
    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) return; // persist once the drag settles, not every pixel
    window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [width, isDragging]);

  // Double-clicking the handle snaps straight to the max width; a second
  // double-click snaps back to the min, rather than restoring whatever
  // custom size was set before.
  const toggleMinMax = useCallback(() => {
    setWidth((current) => (Math.abs(current - maxPanelWidth()) < 1 ? minPanelWidth() : maxPanelWidth()));
  }, []);

  /**
   * Keyboard equivalent of the drag, for the separator handle: arrows nudge,
   * Home/End jump to the bounds. Dragging is otherwise pointer-only, which
   * leaves the panel unresizable for anyone navigating by keyboard even
   * though the handle is exposed as an ARIA separator.
   */
  const onHandleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    // Left grows the panel and right shrinks it, matching the drag: the
    // handle is on the panel's left edge, so it moves with the pointer.
    const step = e.shiftKey ? COARSE_KEYBOARD_STEP_PX : KEYBOARD_STEP_PX;
    switch (e.key) {
      case "ArrowLeft":
        setWidth((current) => clamp(current + step));
        break;
      case "ArrowRight":
        setWidth((current) => clamp(current - step));
        break;
      case "Home":
        setWidth(minPanelWidth());
        break;
      case "End":
        setWidth(maxPanelWidth());
        break;
      default:
        return;
    }
    e.preventDefault();
  }, []);

  return { width, isDragging, startDrag, toggleMinMax, onHandleKeyDown, bounds };
}
