"use client";

import type { MouseEvent } from "react";
import { twMerge } from "tailwind-merge";
import type { CalendarItem, CalendarItemColor } from "../types/calendar-item";
import { useScrollIntoViewWhen } from "./planning/use-scroll-into-view-when";

export interface ItemChipProps {
  item: CalendarItem;
  selected?: boolean;
  reassigning?: boolean;
  /** Matches the active search. */
  highlighted?: boolean;
  /** A search is active and this chip missed it — fade it into the background. */
  dimmed?: boolean;
  /** The match the search navigator is parked on. Scrolls itself into view. */
  focused?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  className?: string;
}

/** Chip accent classes (bg tint + text + left-border), mirroring the freight chip. */
const CHIP_COLOR: Record<CalendarItemColor, string> = {
  blue: "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400",
  purple:
    "bg-purple-100 text-purple-800 border-purple-600 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-400",
};

/**
 * Default planned-grid chip for a CalendarItem. Reproduces the compact
 * PlannedServiceChip look (ID + route subtitle, color-flipped accent, left
 * border bar, selection/reassign rings) from the canonical item only. Hosts
 * needing richer chips (e.g. driver-count icons) override via
 * CalendarHost.renderItemChip.
 */
export function ItemChip({
  item,
  selected = false,
  reassigning = false,
  highlighted = false,
  dimmed = false,
  focused = false,
  onClick,
  onContextMenu,
  className,
}: ItemChipProps) {
  const color = CHIP_COLOR[item.color ?? "blue"];
  const ref = useScrollIntoViewWhen<HTMLButtonElement>(focused);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={item.subtitle ? `${item.id} — ${item.subtitle}` : item.id}
      className={twMerge(
        "min-w-0 w-full pointer-events-auto rounded flex items-center",
        "text-xs font-medium px-1.5 py-1 border-l-4",
        onClick ? "cursor-pointer" : "cursor-context-menu",
        color,
        // Ring precedence, strongest intent first. An in-flight reassignment
        // outranks a search: it is an operation, not a lookup. Search rings are
        // fuchsia so a match never reads as an amber selection.
        reassigning && "ring-2 ring-amber-500 ring-offset-1 animate-pulse",
        !reassigning && focused && "ring-4 ring-fuchsia-600 ring-offset-2",
        !reassigning && !focused && highlighted && "ring-2 ring-fuchsia-500",
        !reassigning &&
          !focused &&
          !highlighted &&
          selected &&
          "ring-2 ring-amber-500 ring-offset-1",
        dimmed && "opacity-30",
        className
      )}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-bold truncate text-left">{item.id}</span>
        {item.subtitle ? (
          <span className="text-[10px] font-normal opacity-80 truncate text-left">
            {item.subtitle}
          </span>
        ) : null}
      </div>
    </button>
  );
}
