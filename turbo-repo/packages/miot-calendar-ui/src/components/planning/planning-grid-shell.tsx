"use client";

import type { ReactNode } from "react";
import type { CalendarItem } from "../../types/calendar-item";
import {
  ShiftOverlayLayer,
  type ShiftOverlayLayerProps,
} from "./shift-overlay-layer";
import {
  PlanningGridOverlays,
  type PlanningGridOverlaysProps,
} from "./planning-grid-overlays";

export interface PlanningGridShellProps<
  TItem extends { id: string } = CalendarItem,
> {
  /**
   * The grid itself (time-axis column + day columns + cells). Receives no
   * props from the shell — the shell only handles outer positioning, the
   * overlay layer mounted on top, and the context-menu / delete-modal
   * overlays at the root.
   */
  readonly children: ReactNode;
  /**
   * Pixel offset from the top of the grid where the shift overlay area
   * starts (i.e. the height of the sticky header band).
   */
  readonly shiftOverlayTopPx: number;
  /**
   * Pixel offset from the left where the shift overlay area starts (i.e.
   * the width of the time-axis column).
   */
  readonly shiftOverlayLeftPx: number;
  /**
   * Props forwarded verbatim to the `<ShiftOverlayLayer>` mounted over the
   * day-columns area.
   */
  readonly shiftOverlay: ShiftOverlayLayerProps<TItem>;
  /**
   * Props forwarded verbatim to the `<PlanningGridOverlays>` rendered at
   * the root of the grid (context menu + delete-confirmation modals).
   */
  readonly gridOverlays: PlanningGridOverlaysProps<TItem>;
}

/**
 * Common scaffolding shared by `DayGrid` and `PlanningWeekView`: the
 * scroll container, the relative wrapper that anchors the shift-overlay
 * layer, and the root-level planning context-menu/modal overlays. Each
 * view supplies its own grid markup as `children`.
 */
export function PlanningGridShell<
  TItem extends { id: string } = CalendarItem,
>({
  children,
  shiftOverlayTopPx,
  shiftOverlayLeftPx,
  shiftOverlay,
  gridOverlays,
}: PlanningGridShellProps<TItem>) {
  return (
    <div className="w-full h-full overflow-auto">
      <div className="relative">
        {children}

        {/* Shift overlay: each rectangle owns its own chips and "add
            booking" affordance. Positioned over the day-columns area
            (right of the time axis, below the sticky header). */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: shiftOverlayTopPx,
            left: shiftOverlayLeftPx,
            right: 0,
            bottom: 0,
          }}
        >
          <ShiftOverlayLayer<TItem> {...shiftOverlay} />
        </div>
      </div>

      {/* Context menu + delete modals (rendered at the scroll-container
          root, outside the relative wrapper, so they're not clipped). */}
      <PlanningGridOverlays<TItem> {...gridOverlays} />
    </div>
  );
}
