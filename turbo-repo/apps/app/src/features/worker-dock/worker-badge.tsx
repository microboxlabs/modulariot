"use client";

import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { CssOrb } from "./css-orb";

/**
 * The flat colour disc a worker leaves behind in a spot its orb has sunk out
 * of (the dock button while the persona is open, the chat title once the
 * conversation starts). Plain 2D circle — no eyes, no sphere. It expands in
 * from nothing, and with `leaving` it shrinks + fades back out (e.g. as the
 * orb reappears over it) instead of vanishing instantly.
 */
export function WorkerBadge({
  color,
  className,
  leaving = false,
}: Readonly<{ color: string; className?: string; leaving?: boolean }>) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    // double rAF so the browser paints the scale(0) state before transitioning
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const visible = shown && !leaving;
  return (
    <span
      className={twMerge(
        "flex shrink-0 origin-center transition-[transform,opacity] duration-420",
        leaving ? "ease-in" : "ease-[cubic-bezier(.34,1.56,.64,1)]",
        className,
      )}
      style={{
        transform: visible ? "scale(1)" : "scale(0)",
        opacity: visible ? 1 : 0,
      }}
    >
      <CssOrb color={color} plain className="h-full w-full" />
    </span>
  );
}
