"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FC,
} from "react";
import {
  HiAdjustments,
  HiChevronLeft,
  HiChevronRight,
  HiClock,
  HiFilter,
  HiSearch,
  HiViewGrid,
} from "react-icons/hi";
import { MdDragIndicator } from "react-icons/md";
import { twMerge } from "tailwind-merge";

/* ==========================================================================
 * 1. Search — responsive
 *
 * An input-looking field while there is room; when its container gets narrow
 * it collapses to a square button (same h-10 w-10 footprint as the harness
 * toggle). Either way ⌘K opens it. Placeholder for <SpotlightSearch>.
 * ======================================================================== */

export function SearchField() {
  return (
    <div className="@container flex w-full min-w-10 justify-end">
      {/* Wide: input */}
      <button
        type="button"
        title="Search (⌘K)"
        className="hidden h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400 @[11rem]:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
      >
        <HiSearch className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search…</span>
        <kbd className="rounded border border-gray-300 px-1.5 text-[11px] dark:border-gray-600">
          ⌘K
        </kbd>
      </button>

      {/* Narrow: square button */}
      <button
        type="button"
        title="Search (⌘K)"
        aria-label="Search (⌘K)"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-transparent bg-gray-100 text-gray-500 transition-colors hover:border-gray-300 @[11rem]:hidden dark:bg-gray-700 dark:text-gray-400 dark:hover:border-gray-600"
      >
        <HiSearch className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ==========================================================================
 * 2. Assignment-page tools
 *
 * The control set from the calendar/assignment header (Today, date nav, view
 * switcher, source filter, rules) — mocked so the two placements can be
 * compared: "in bar" (page-actions group of the header) vs "floating" cart.
 * ======================================================================== */

interface Tool {
  id: string;
  icon: FC<ComponentProps<"svg">>;
  label: string;
}

const TOOLS: readonly Tool[] = [
  { id: "today", icon: HiClock, label: "Today" },
  { id: "prev", icon: HiChevronLeft, label: "Previous period" },
  { id: "next", icon: HiChevronRight, label: "Next period" },
  { id: "view", icon: HiViewGrid, label: "View: week" },
  { id: "source", icon: HiFilter, label: "Source filter" },
  { id: "rules", icon: HiAdjustments, label: "Calendar rules" },
];

/** In-bar rendering: a labelled row that mirrors the assignment header. */
// Every in-bar control shares the header's control height (h-10, same as the
// bell / theme / harness buttons) so the strip reads as one row.
const CTRL = "h-10 text-sm font-medium text-gray-700 dark:text-gray-200";
const CTRL_BORDER = "rounded-lg border border-gray-200 dark:border-gray-600";
const CTRL_HOVER = "hover:bg-gray-100 dark:hover:bg-gray-700";

export function AssignmentBarActions() {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={twMerge(CTRL, CTRL_BORDER, CTRL_HOVER, "px-3")}
      >
        Today
      </button>

      <div
        className={twMerge(
          CTRL_BORDER,
          "inline-flex h-10 items-stretch overflow-hidden"
        )}
      >
        <button
          type="button"
          aria-label="Previous period"
          className={twMerge(
            CTRL_HOVER,
            "flex w-9 items-center justify-center"
          )}
        >
          <HiChevronLeft className="h-5 w-5" />
        </button>
        <span
          className={twMerge(
            CTRL,
            "flex items-center border-x border-gray-200 px-3 dark:border-gray-600"
          )}
        >
          Aug 4 – 10
        </span>
        <button
          type="button"
          aria-label="Next period"
          className={twMerge(
            CTRL_HOVER,
            "flex w-9 items-center justify-center"
          )}
        >
          <HiChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div
        className={twMerge(
          CTRL_BORDER,
          "inline-flex h-10 items-stretch overflow-hidden"
        )}
      >
        {["Day", "Week", "Month"].map((v) => (
          <button
            key={v}
            type="button"
            className={twMerge(
              "px-3 text-sm font-medium",
              v === "Week"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={twMerge(
          CTRL,
          CTRL_BORDER,
          CTRL_HOVER,
          "inline-flex items-center gap-2 px-3"
        )}
      >
        <HiFilter className="h-5 w-5" />
        Source
      </button>

      <button
        type="button"
        aria-label="Calendar rules"
        className={twMerge(
          CTRL,
          CTRL_BORDER,
          CTRL_HOVER,
          "flex w-10 items-center justify-center"
        )}
      >
        <HiAdjustments className="h-5 w-5" />
      </button>
    </div>
  );
}

/** Minimal round icon button used inside the floating cart. */
function RoundTool({ tool }: Readonly<{ tool: Tool }>) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      aria-label={tool.label}
      title={tool.label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Floating "cart" of tools: a rounded pill (rounded-l-md rounded-r-full) with a
 * dotted drag handle on the left. Drag it anywhere inside the viewport frame.
 */
export function FloatingActionsCart({
  boundsRef,
}: Readonly<{ boundsRef: React.RefObject<HTMLElement | null> }>) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  // Start bottom-right of the frame once we can measure it.
  useEffect(() => {
    if (pos || !boundsRef.current || !elRef.current) return;
    const b = boundsRef.current.getBoundingClientRect();
    const e = elRef.current.getBoundingClientRect();
    setPos({ x: b.width - e.width - 16, y: b.height - e.height - 16 });
  }, [pos, boundsRef]);

  const onPointerMove = useCallback(
    (ev: PointerEvent) => {
      const drag = dragRef.current;
      const bounds = boundsRef.current;
      const el = elRef.current;
      if (!drag || !bounds || !el) return;
      const b = bounds.getBoundingClientRect();
      const x = ev.clientX - b.left - drag.dx;
      const y = ev.clientY - b.top - drag.dy;
      setPos({
        x: Math.max(0, Math.min(x, b.width - el.offsetWidth)),
        y: Math.max(0, Math.min(y, b.height - el.offsetHeight)),
      });
    },
    [boundsRef]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const startDrag = (ev: React.PointerEvent) => {
    const el = elRef.current;
    if (!el) return;
    const e = el.getBoundingClientRect();
    dragRef.current = { dx: ev.clientX - e.left, dy: ev.clientY - e.top };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  };

  useEffect(() => endDrag, [endDrag]);

  return (
    <div
      ref={elRef}
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : { right: 16, bottom: 16, visibility: "hidden" }
      }
      className="absolute z-40 flex items-center gap-1.5 rounded-l-md rounded-r-full border border-gray-200 bg-white p-1.5 pr-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        type="button"
        aria-label="Drag tools"
        onPointerDown={startDrag}
        className="flex h-8 w-5 cursor-grab touch-none items-center justify-center rounded-l-md text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:hover:text-gray-200"
      >
        <MdDragIndicator className="h-5 w-5" />
      </button>
      {TOOLS.map((tool) => (
        <RoundTool key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
