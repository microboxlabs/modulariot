"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export const PANEL_MOTION_MS = 280;
export const STEP_SWAP_MS = 200;

/** Side bar unroll: one duration and easing for the bar and whatever moves
 * beside it (the notch), so both travel as one piece. */
export const EXPAND_MS = 300;
export const EXPAND_TRANSITION =
  "duration-300 ease-out motion-reduce:duration-0";

/**
 * Open flag of a panel: turns on two frames after `show` (so the closed state
 * paints first and the transition runs) and off at once. Things that move
 * with a panel use it too, so they start on the very same frame.
 */
export function usePanelOpen(show: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) {
      setOpen(false);
      return;
    }
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setOpen(true));
    });
    return () => cancelAnimationFrame(id);
  }, [show]);

  return open;
}

function usePresence(
  show: boolean,
  children: ReactNode,
  ms: number = PANEL_MOTION_MS
) {
  const [rendered, setRendered] = useState(show);
  const open = usePanelOpen(show);
  const [held, setHeld] = useState(children);
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useEffect(() => {
    if (show) {
      setRendered(true);
      return;
    }
    setHeld(childrenRef.current);
    const t = window.setTimeout(() => setRendered(false), ms);
    return () => window.clearTimeout(t);
  }, [show, ms]);

  return { rendered, open, content: show ? children : held };
}

export function GrowPanel({
  show,
  children,
  className,
}: Readonly<{
  show: boolean;
  children: ReactNode;
  className?: string;
}>) {
  const { rendered, open, content } = usePresence(show, children);
  if (!rendered) return null;

  return (
    <div
      data-panel-motion={open ? "open" : "closed"}
      className={twMerge(
        "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:duration-0 motion-reduce:transform-none",
        open
          ? "grid-rows-[1fr] translate-y-0 opacity-100"
          : "grid-rows-[0fr] -translate-y-2 opacity-0",
        className
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {content}
      </div>
    </div>
  );
}

/**
 * Fade out, swap content while hidden, then fade in — layout changes stay
 * invisible. `step` is any key (a step number, or a string naming what is
 * shown); `shown` lags behind it while the old content fades out.
 */
export function useOutThenIn<T extends string | number>(
  step: T,
  /** Cuánto dura el fundido de salida; la clase de transición debe coincidir. */
  ms: number = STEP_SWAP_MS
): {
  shown: T;
  visible: boolean;
} {
  const [shown, setShown] = useState(step);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (step === shown) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setShown(step), ms);
    return () => window.clearTimeout(t);
  }, [step, shown, ms]);

  return { shown, visible };
}

/** Shows one step at a time. Pair with useOutThenIn so the swap happens while faded out. */
export function StepSwap({
  step,
  visible = true,
  first,
  second,
  className,
}: Readonly<{
  step: 0 | 1;
  visible?: boolean;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}>) {
  return (
    <div
      data-step-swap={step}
      data-step-visible={visible ? "in" : "out"}
      className={twMerge(
        "transition-opacity duration-200 ease-out motion-reduce:duration-0",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className
      )}
    >
      {step === 0 ? first : second}
    </div>
  );
}

export function SlidePanel({
  show,
  children,
  className,
  from = "right",
}: Readonly<{
  show: boolean;
  children: ReactNode;
  className?: string;
  from?: "right" | "left";
}>) {
  const { rendered, open, content } = usePresence(show, children);
  if (!rendered) return null;

  const hidden =
    from === "left" ? "-translate-x-6 opacity-0" : "translate-x-6 opacity-0";

  return (
    <div
      data-panel-motion={open ? "open" : "closed"}
      className={twMerge(
        "transition duration-300 ease-out motion-reduce:duration-0 motion-reduce:transform-none",
        open ? "translate-x-0 opacity-100" : hidden,
        className
      )}
    >
      {content}
    </div>
  );
}

/**
 * Side bar that unrolls from the right edge: only its width animates (no
 * fade). The content keeps its full width and is pinned to the bar's moving
 * left edge, so it travels in whole with the bar instead of being uncovered.
 */
export function ExpandPanel({
  show,
  children,
  width,
  className,
  innerClassName,
}: Readonly<{
  show: boolean;
  children: ReactNode;
  /** full width when open, e.g. "w-110" */
  width: string;
  className?: string;
  innerClassName?: string;
}>) {
  // stays mounted for the whole close, not cut before the bar is folded
  const { rendered, open, content } = usePresence(show, children, EXPAND_MS);
  if (!rendered) return null;

  return (
    <div
      data-panel-motion={open ? "open" : "closed"}
      className={twMerge(
        "overflow-hidden transition-[width]",
        EXPAND_TRANSITION,
        open ? width : "w-0",
        className
      )}
    >
      <div
        className={twMerge(
          "absolute top-0 bottom-0 left-0 flex flex-col",
          width,
          innerClassName
        )}
      >
        {content}
      </div>
    </div>
  );
}
