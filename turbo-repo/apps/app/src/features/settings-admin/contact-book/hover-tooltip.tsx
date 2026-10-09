"use client";

import { useEffect, useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Card-style tooltip: light surface, soft border and shadow, no arrow.
 *  `pointer-events-none` so it can never be hovered itself. */
const METHOD_TOOLTIP_CLASS =
  "pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-lg shadow-gray-900/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-black/40";
const TOOLTIP_GAP_PX = 8;

/**
 * Shows `content` above its child ONLY while the pointer is over the child
 * (or it has keyboard focus). Unlike Flowbite's Tooltip, it doesn't stay open
 * while hovering the tooltip itself or after a click leaves the button
 * focused. Rendered in a portal with fixed positioning so an overflow
 * container (the table, a modal) can't clip it; any scroll closes it.
 */
export default function HoverTooltip({
  content,
  children,
}: Readonly<{ content: ReactNode; children: ReactNode }>) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [anchor]);

  const showFor = (el: HTMLElement) => setAnchor(el.getBoundingClientRect());
  const hide = () => setAnchor(null);
  const handleFocus = (e: FocusEvent<HTMLSpanElement>) => {
    if (e.target.matches(":focus-visible")) showFor(e.currentTarget);
  };

  return (
    <>
      <span
        className="inline-flex"
        onMouseEnter={(e) => showFor(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={handleFocus}
        onBlur={hide}
      >
        {children}
      </span>
      {anchor &&
        createPortal(
          <div
            role="tooltip"
            className={METHOD_TOOLTIP_CLASS}
            style={{
              left: anchor.left + anchor.width / 2,
              top: anchor.top - TOOLTIP_GAP_PX,
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
