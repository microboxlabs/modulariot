"use client";

// The generic `PlanningGridShell` now lives in @microboxlabs/miot-calendar-ui.
// This module re-exports it and keeps the freight-domain glue
// (`buildPlanningGridShellProps`) app-side: it wires the domain chip
// (PlannedServiceChip), the permission/nav-aware ServiceContextMenu, and the
// i18n message bundles into the package's render-prop / ReactNode seams so the
// package itself stays domain-agnostic.

import {
  getDeleteModalMessages,
  getDeleteAssignmentMessages,
  type ShiftOverlayLayerProps,
  type PlanningGridOverlaysProps,
  type CalendarI18n,
  type PlannedService,
  type PositionedShift,
} from "@microboxlabs/miot-calendar-ui";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { SelectedService } from "./planning-selection-types";
import type { UsePlanningGridReturn } from "./use-planning-grid";
import { PlannedServiceChip } from "./planned-service-chip";
import { ServiceContextMenu } from "./service-context-menu";

export {
  PlanningGridShell,
  type PlanningGridShellProps,
} from "@microboxlabs/miot-calendar-ui";

/**
 * Build the `shiftOverlay` + `gridOverlays` prop bundles for
 * `<PlanningGridShell>` from the planning-grid hook plus the view-specific
 * overlay computeds. Lifts the per-view boilerplate out of `DayGrid` and
 * `PlanningWeekView`, and binds the freight domain UI (chip + context menu +
 * translated copy) into the package's seams.
 */
export function buildPlanningGridShellProps(params: {
  planningGrid: UsePlanningGridReturn;
  positionedShifts: readonly PositionedShift[];
  onShiftClick: (shift: PositionedShift) => void;
  isShiftSelected: (shift: PositionedShift) => boolean;
  getServicesForShift: (
    shift: PositionedShift
  ) => readonly PlannedService<SelectedService>[];
  isWindowFull: (shift: PositionedShift) => boolean;
  dict: I18nDictionary;
}): {
  shiftOverlay: ShiftOverlayLayerProps<SelectedService>;
  gridOverlays: PlanningGridOverlaysProps<SelectedService>;
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

  // Adapt the app's narrowly-typed `tr` to the package's generic i18n seam.
  const i18n: CalendarI18n = {
    dict,
    tr: (path, d, p) =>
      tr(
        path,
        d as Parameters<typeof tr>[1],
        p as Parameters<typeof tr>[2]
      ),
  };

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
      windowFullTooltip: tr("pages.planning.grid.windowFullTooltip", dict),
      // Domain chip override — keeps driver icons, urgencia color, route +
      // category badge that the package default ItemChip can't reproduce.
      renderChip: (ps, ctx) => (
        <PlannedServiceChip
          plannedService={ps}
          isBeingReassigned={ctx.reassigning}
          isSelected={ctx.selected}
          onContextMenu={ctx.onContextMenu}
          onClick={ctx.onClick}
          className="w-full"
          dict={dict}
        />
      ),
    },
    gridOverlays: {
      // Permission/nav-aware menu stays host-side; mounted by the package.
      contextMenu: (
        <ServiceContextMenu
          isOpen={pg.contextMenu.isOpen}
          position={pg.contextMenu.position}
          plannedService={pg.contextMenu.plannedService}
          onReassign={pg.handleReassign}
          onAssign={pg.handleAssign}
          onDelete={pg.handleDeleteRequest}
          onDeleteAssignment={pg.handleDeleteAssignmentRequest}
          onClose={pg.handleCloseContextMenu}
          dict={dict}
        />
      ),
      deleteModal: pg.deleteModal,
      deleteModalMessages: getDeleteModalMessages(i18n),
      onConfirmDelete: pg.handleConfirmDelete,
      onCancelDelete: pg.handleCancelDelete,
      deleteAssignmentModal: pg.deleteAssignmentModal,
      deleteAssignmentMessages: getDeleteAssignmentMessages(i18n),
      onConfirmDeleteAssignment: pg.handleConfirmDeleteAssignment,
      onCancelDeleteAssignment: pg.handleCancelDeleteAssignment,
      reassigningService: pg.reassigningService,
      selectedSlot: pg.selectedSlot,
    },
  };
}
