"use client";

import type { FC } from "react";
import { twMerge } from "tailwind-merge";
import type { useResizablePanelWidth } from "../hooks/use-resizable-panel-width";

type Resizable = ReturnType<typeof useResizablePanelWidth>;

/** The drag handle on a side panel's left edge. */
export const PanelResizeHandle: FC<{ label: string; resizable: Resizable }> = ({
  label,
  resizable: {
    width,
    bounds,
    isDragging,
    startDrag,
    toggleMinMax,
    onHandleKeyDown,
  },
}) => (
  // This is the WAI-ARIA window-splitter pattern: a *focusable*
  // separator, which ARIA classes as a widget role — hence the
  // tabIndex, the value attributes and the key handler below. Sonar's
  // S6845/S6847 (and jsx-a11y, which they mirror) read `separator` off
  // a static role map that has no way to know this one is focusable,
  // so they see a non-interactive div carrying tabIndex and handlers.
  // The NOSONAR markers are for those two false positives; removing
  // them would mean giving up either the keyboard resize or the
  // correct role.
  <div /* NOSONAR */
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    // Dragging is pointer-only, so without this the panel is stuck at
    // whatever width a keyboard user finds it at. Arrows nudge (Shift
    // for a coarser step), Home/End snap to the bounds.
    tabIndex={0 /* NOSONAR */}
    aria-valuenow={Math.round(width)}
    aria-valuemin={Math.round(bounds.min)}
    aria-valuemax={Math.round(bounds.max)}
    onKeyDown={onHandleKeyDown}
    onPointerDown={startDrag}
    onDoubleClick={toggleMinMax}
    // Stays inside the panel's own bounds (not straddling the border) — a
    // wrapper's overflow-hidden, needed for an open/close collapse
    // animation, would clip anything hanging outside it.
    className="group absolute inset-y-0 left-0 z-20 flex w-2.5 cursor-col-resize touch-none select-none items-center justify-center"
  >
    <div
      className={twMerge(
        "h-8 w-1 rounded-full transition-colors duration-150",
        isDragging
          ? "bg-gray-500 dark:bg-gray-300"
          : "bg-gray-300 group-hover:bg-gray-400 group-focus-visible:bg-gray-500 dark:bg-gray-600 dark:group-hover:bg-gray-400 dark:group-focus-visible:bg-gray-300"
      )}
    />
  </div>
);
