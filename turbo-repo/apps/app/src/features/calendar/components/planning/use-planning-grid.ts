"use client";

import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import {
  isTimeWindow,
  usePlanningSelection,
  type PlannedService,
  type TimeWindow,
} from "./planning-selection-context";
import type { PositionedShift } from "./shift-layout";
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
    andenesCount,
  } = usePlanningSelection();

  // Clear every assignment slot on the planned service — carrier, drivers,
  // truck and trailer (plus their upstream external_id codes) — so
  // reopening the sidebar for this entry starts clean.
  const removeAssignment = useCallback(
    async (serviceId: string) => {
      updateServiceAssignment(serviceId, {
        assignedCarrier: undefined,
        assignedDriver: undefined,
        assignedDriver2: undefined,
        assignedTruck: undefined,
        assignedTrailer: undefined,
        assignedCarrierExternalId: undefined,
        assignedDriverExternalId: undefined,
        assignedDriver2ExternalId: undefined,
        assignedTruckExternalId: undefined,
        assignedTrailerExternalId: undefined,
      });
    },
    [updateServiceAssignment]
  );

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

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour),
    [startHour, endHour]
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

    // Service actions (context menu, delete modals). Spread first, then
    // override the open/close handlers with the wrapped versions that also
    // manage the chip's right-click highlight.
    ...serviceActions,
    handleContextMenu: handleChipContextMenu,
    handleCloseContextMenu: handleCloseChipContextMenu,
  };
}

export type UsePlanningGridReturn = ReturnType<typeof usePlanningGrid>;
