"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export const PANEL_MOTION_MS = 280;
export const STEP_SWAP_MS = 200;

function usePresence(show: boolean, children: ReactNode) {
  const [rendered, setRendered] = useState(show);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(children);
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useEffect(() => {
    if (show) {
      setRendered(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setHeld(childrenRef.current);
    setOpen(false);
    const t = window.setTimeout(() => setRendered(false), PANEL_MOTION_MS);
    return () => window.clearTimeout(t);
  }, [show]);

  return { rendered, open, content: show ? children : held };
}

export function GrowPanel({
  show,
  children,
  className,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
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

/** Fade out, swap content while hidden, then fade in — layout changes stay invisible. */
export function useOutThenIn(step: 0 | 1): {
  shown: 0 | 1;
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
    const t = window.setTimeout(() => setShown(step), STEP_SWAP_MS);
    return () => window.clearTimeout(t);
  }, [step, shown]);

  return { shown, visible };
}

/** Shows one step at a time. Pair with useOutThenIn so the swap happens while faded out. */
export function StepSwap({
  step,
  visible = true,
  first,
  second,
  className,
}: {
  step: 0 | 1;
  visible?: boolean;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}) {
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
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  from?: "right" | "left";
}) {
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
