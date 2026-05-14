"use client";

import type { ComponentProps, ReactNode } from "react";
import { ShiftOverlayLayer } from "./shift-overlay-layer";
import { PlanningGridOverlays } from "./planning-grid-overlays";
import type { PlannedService } from "./planning-selection-context";
import type { PositionedShift } from "./shift-layout";
import type { UsePlanningGridReturn } from "./use-planning-grid";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface PlanningGridShellProps {
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
  readonly shiftOverlay: ComponentProps<typeof ShiftOverlayLayer>;
  /**
   * Props forwarded verbatim to the `<PlanningGridOverlays>` rendered at
   * the root of the grid (context menu + delete-confirmation modals).
   */
  readonly gridOverlays: ComponentProps<typeof PlanningGridOverlays>;
}

/**
 * Common scaffolding shared by `DayGrid` and `PlanningWeekView`: the
 * scroll container, the relative wrapper that anchors the shift-overlay
 * layer, and the root-level planning context-menu/modal overlays. Each
 * view supplies its own grid markup as `children`.
 *
 * Lifted out of the two views to remove the previous ~50-line copy of
 * identical wrapping JSX.
 */
/**
 * Build the `shiftOverlay` + `gridOverlays` prop bundles for
 * `<PlanningGridShell>` from the planning-grid hook plus the view-specific
 * overlay computeds. Lifts the per-view boilerplate (15+ identical fields
 * per bundle wired to the same hook) out of `DayGrid` and `PlanningWeekView`.
 */
export function buildPlanningGridShellProps(params: {
  planningGrid: UsePlanningGridReturn;
  positionedShifts: readonly PositionedShift[];
  onShiftClick: (shift: PositionedShift) => void;
  isShiftSelected: (shift: PositionedShift) => boolean;
  getServicesForShift: (shift: PositionedShift) => readonly PlannedService[];
  isWindowFull: (shift: PositionedShift) => boolean;
  dict: I18nDictionary;
}): {
  shiftOverlay: ComponentProps<typeof ShiftOverlayLayer>;
  gridOverlays: ComponentProps<typeof PlanningGridOverlays>;
} {
  const {
    planningGrid: pg,
    positionedShifts,
    onShiftClick,
    isShiftSelected,
    getServicesForShift,
    isWindowFull,
    dict,
  } = params;
  return {
    shiftOverlay: {
      shifts: positionedShifts,
      onShiftClick,
      isShiftSelected,
      getServicesForShift,
      isWindowFull,
      onChipClick: pg.selectChipSlot,
      onChipContextMenu: pg.handleContextMenu,
      reassigningServiceId: pg.reassigningService?.service.service.id,
      isChipSelected: pg.isChipSelected,
      dict,
    },
    gridOverlays: {
      dict,
      contextMenu: pg.contextMenu,
      onReassign: pg.handleReassign,
      onAssign: pg.handleAssign,
      onDeleteRequest: pg.handleDeleteRequest,
      onDeleteAssignmentRequest: pg.handleDeleteAssignmentRequest,
      onCloseContextMenu: pg.handleCloseContextMenu,
      deleteModal: pg.deleteModal,
      onConfirmDelete: pg.handleConfirmDelete,
      onCancelDelete: pg.handleCancelDelete,
      deleteAssignmentModal: pg.deleteAssignmentModal,
      onConfirmDeleteAssignment: pg.handleConfirmDeleteAssignment,
      onCancelDeleteAssignment: pg.handleCancelDeleteAssignment,
      reassigningService: pg.reassigningService,
      selectedSlot: pg.selectedSlot,
    },
  };
}

export function PlanningGridShell({
  children,
  shiftOverlayTopPx,
  shiftOverlayLeftPx,
  shiftOverlay,
  gridOverlays,
}: PlanningGridShellProps) {
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
          <ShiftOverlayLayer {...shiftOverlay} />
        </div>
      </div>

      {/* Context menu + delete modals (rendered at the scroll-container
          root, outside the relative wrapper, so they're not clipped). */}
      <PlanningGridOverlays {...gridOverlays} />
    </div>
  );
}
