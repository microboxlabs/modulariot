"use client";

import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import {
  isTimeWindow,
  usePlanningSelection,
  TimeWindowUtils,
  type PlannedService,
  type TimeSlot,
  type TimeWindow,
} from "./planning-selection-context";
import type { PositionedShift } from "@microboxlabs/miot-calendar-ui";
import { useServiceActions } from "./use-service-actions";
import { useCalendarViewMode } from "./use-calendar-view-mode";
import { generateTimeSlots } from "@/features/calendar/services/calendar.service";

// ============================================================================
// Types
// ============================================================================

interface UsePlanningGridOptions {
  startHour?: number;
  endHour?: number;
}

interface SlotIdentifier {
  date: Date;
  hour: number;
  minutes: number;
  dayIndex?: number;
}

/**
 * Resolve the grid's visible hour span. The `[baseStartHour, baseEndHour]`
 * range is a floor, not a fixed window: it expands outward (never shrinks) to
 * cover any bookable time window or planned service that falls earlier or
 * later. Without this, a booking outside the baseline — e.g. a 05:00 window
 * while the grid starts at 08:00 — has no row to sit in: its shift rectangle
 * clamps to the grid's top edge and collapses to a sliver, so all its chips
 * pile up at that one line and overlap. Rounding keeps the span whole-hour
 * aligned with `generateTimeSlots`, which steps by the hour: the start floors
 * to the hour, and the end rounds up so a window ending at HH:MM (>HH:00) or a
 * service in hour HH still gets a rendered row.
 *
 * Only bookable WINDOW entries drive the span. BLOCK entries mark closed /
 * out-of-hours periods and can legitimately span the whole day (a "Fuera de
 * Horario" block from 00:00–23:00); folding them in would pull the grid back
 * to midnight even when every bookable window and every booking starts much
 * later. Blocks still render as closed cells wherever they fall inside the
 * resolved span — they just don't get to widen it.
 */
function computeGridHourRange(
  configuredTimeSlots: readonly TimeSlot[],
  plannedServices: readonly PlannedService[],
  baseStartHour: number,
  baseEndHour: number
): { startHour: number; endHour: number } {
  let startHour = baseStartHour;
  let endHour = baseEndHour;

  for (const tw of configuredTimeSlots) {
    // Skip BLOCK entries — only bookable windows define the working span.
    if (!isTimeWindow(tw)) continue;
    const range = TimeWindowUtils.getTimeRange(tw);
    if (!range) continue;
    startHour = Math.min(startHour, range.startHour);
    endHour = Math.max(
      endHour,
      range.endHour + (range.endMinutes > 0 ? 1 : 0)
    );
  }

  for (const ps of plannedServices) {
    startHour = Math.min(startHour, ps.slot.hour);
    endHour = Math.max(endHour, ps.slot.hour + 1);
  }

  // Clamp to a valid 0..24 day and guarantee a non-empty span.
  startHour = Math.max(0, Math.min(startHour, 23));
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  return { startHour, endHour };
}

// ============================================================================
// Hook
// ============================================================================

export function usePlanningGrid(options: UsePlanningGridOptions = {}) {
  const { startHour = 8, endHour = 22 } = options;

  // Effective view-mode for the calendar — already honors the
  // `?as=viewer` URL override for users with GROUP_CALENDAR_VIEWER.
  // Fail-closed: every flag is false while permissions load.
  const { canPlan, canAssign, canView, isViewerOnly } = useCalendarViewMode();

  const {
    selectedSlot,
    selectSlot,
    plannedServices,
    timeSlots: configuredTimeSlots,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    removeService,
    removeAssignment,
    startReassignment,
    startAssignment,
    reassigningService,
    selectChipSlot,
    selectChipResource,
    inspectPlannedService,
    isChipSelected,
    clearChipSelection,
    isItemHighlighted,
    isItemDimmed,
    focusedItemId,
    andenesCount,
  } = usePlanningSelection();

  // Use shared hook for context menu and delete modal
  const serviceActions = useServiceActions({
    removeService,
    removeAssignment,
    startReassignment,
    startAssignment,
  });

  // Right-click on a chip highlights it (corner ring) AND opens the context
  // menu. The highlight is purely visual — `selectChipResource` does not
  // touch slot/service selection, so the sidebar stays as-is. For pure
  // viewers (GROUP_CALENDAR_VIEWER only) we also call `inspectPlannedService`
  // because right-click is their sole entry to the sidebar; for planners
  // the sidebar opens via the menu's "Abrir servicio (Solo Lectura)"
  // action instead, which flips the URL and inspects in one step.
  const handleChipContextMenu = useCallback(
    (e: React.MouseEvent, plannedService: PlannedService) => {
      selectChipResource(plannedService);
      if (isViewerOnly) {
        inspectPlannedService(plannedService);
      }
      serviceActions.handleContextMenu(e, plannedService);
    },
    [selectChipResource, inspectPlannedService, isViewerOnly, serviceActions]
  );

  // Left-click on a chip opens the sidebar in "add to slot" mode for users
  // who can plan. Viewers have nothing actionable there — chip data is
  // already reachable via right-click — so the handler is dropped entirely,
  // which also flips the chip's cursor to `cursor-context-menu`.
  const handleChipClick = useMemo(
    () => (isViewerOnly ? undefined : selectChipSlot),
    [isViewerOnly, selectChipSlot]
  );

  // The chip highlight lives alongside the context menu — closing the menu
  // (outside click, Escape, or picking an action) drops the highlight too.
  // Actions that transition into reassign/assign mode pick up their own
  // visual treatment from there, so there's no flash of "nothing selected".
  const handleCloseChipContextMenu = useCallback(() => {
    serviceActions.handleCloseContextMenu();
    clearChipSelection();
  }, [serviceActions, clearChipSelection]);

  // Adapt the visible hour span to the data so nothing renders outside the
  // grid (see computeGridHourRange). Both the row axis (timeSlots below) and
  // the shift-overlay geometry in the package views must use the SAME start
  // hour, so these values are also returned for the caller to forward to the
  // day/week views as startHour/endHour.
  const { startHour: gridStartHour, endHour: gridEndHour } = useMemo(
    () =>
      computeGridHourRange(
        configuredTimeSlots,
        plannedServices,
        startHour,
        endHour
      ),
    [configuredTimeSlots, plannedServices, startHour, endHour]
  );

  const timeSlots = useMemo(
    () => generateTimeSlots(gridStartHour, gridEndHour),
    [gridStartHour, gridEndHour]
  );

  const isLastSlot = useCallback(
    (idx: number) => idx === timeSlots.length - 1,
    [timeSlots.length]
  );

  const handleSelectSlot = useCallback(
    (slot: SlotIdentifier) => {
      if (!canPlan) return;
      selectSlot(slot);
    },
    [selectSlot, canPlan]
  );

  const isSlotSelected = useCallback(
    (date: Date, hour: number, minutes: number) => {
      if (!selectedSlot) return false;
      return (
        dayjs(selectedSlot.date).isSame(date, "day") &&
        selectedSlot.hour === hour &&
        selectedSlot.minutes === minutes
      );
    },
    [selectedSlot]
  );

  const getPlannedServicesForSlot = useCallback(
    (date: Date, hour: number, minutes: number): PlannedService[] => {
      const cellStartMin = hour * 60 + minutes;
      const cellEndMin = cellStartMin + 30;
      return plannedServices.filter((ps) => {
        if (!dayjs(ps.slot.date).isSame(date, "day")) return false;
        const serviceMin = ps.slot.hour * 60 + ps.slot.minutes;
        return serviceMin >= cellStartMin && serviceMin < cellEndMin;
      });
    },
    [plannedServices]
  );

  // Lookup TW config by id + a per-shift "is this window at its booking capacity for the day?"
  // check derived from the planned services. When true, no shift in that window accepts a new
  // booking (the empty ones render as muted "spare" slots in the overlay). `getRemainingQuota`
  // clamps at 0 and already excludes the service being reassigned.
  const timeWindowById = useMemo(() => {
    const map = new Map<string, TimeWindow>();
    for (const tw of configuredTimeSlots) {
      if (isTimeWindow(tw)) map.set(tw.id, tw);
    }
    return map;
  }, [configuredTimeSlots]);
  const isShiftWindowFull = useCallback(
    (shift: PositionedShift) => {
      const tw = timeWindowById.get(shift.twId);
      return tw ? getRemainingQuota(tw, shift.date) <= 0 : false;
    },
    [timeWindowById, getRemainingQuota]
  );

  return {
    // Permission
    canPlan,
    canAssign,
    canView,
    isViewerOnly,

    // Slot selection
    selectedSlot,
    handleSelectSlot,
    isSlotSelected,

    // Time slots
    timeSlots,
    isLastSlot,

    // Resolved visible hour span (adapted to the data). Forward these to the
    // package day/week views so their shift-overlay pixel origin (dayStartMin)
    // matches the row axis generated above.
    startHour: gridStartHour,
    endHour: gridEndHour,

    // Configured TWs/blocks for the current calendar (used by overlays
    // that need to know the real shift cadence per time window).
    configuredTimeSlots,

    // Calendar parallelism (andenes count).
    andenesCount,

    // Per-shift "is the parent window at its day-capacity?" gate used by the overlay layer to
    // mark empty rectangles in a full window as muted "spare" slots (no add affordance).
    isShiftWindowFull,

    // Planned services
    plannedServices,
    getPlannedServicesForSlot,

    // Slot state helpers
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,

    // Reassignment
    reassigningService,

    // Left-click on a chip: select only the slot (clears any prior service).
    // Viewer-only callers receive `undefined`, dropping the chip's onClick so
    // left-click becomes a no-op and the cursor switches to context-menu.
    selectChipSlot: handleChipClick,

    // Predicate the chip uses to render its right-click highlight ring.
    isChipSelected,

    // Search highlight: which chips matched, which missed, and which one the
    // match navigator is parked on.
    isItemHighlighted,
    isItemDimmed,
    focusedItemId,

    // Service actions (context menu, delete modals). Spread first, then
    // override the open/close handlers with the wrapped versions that also
    // manage the chip's right-click highlight.
    ...serviceActions,
    handleContextMenu: handleChipContextMenu,
    handleCloseContextMenu: handleCloseChipContextMenu,
  };
}

export type UsePlanningGridReturn = ReturnType<typeof usePlanningGrid>;
