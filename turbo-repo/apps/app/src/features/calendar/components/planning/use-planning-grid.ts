"use client";

import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import {
  isTimeWindow,
  usePlanningSelection,
  type PlannedService,
  type TimeWindow,
} from "./planning-selection-context";
import type { PositionedShift } from "./shift-layout";
import { useServiceActions } from "./use-service-actions";
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

  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  // Fail-closed: block interactions until permission check completes
  const canPlan = !isLoadingPermissions && hasPermission(["GROUP_PLANNING"]);

  const {
    selectedSlot,
    selectSlot,
    plannedServices,
    timeSlots: configuredTimeSlots,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    removeService,
    startReassignment,
    startAssignment,
    reassigningService,
    updateServiceAssignment,
    viewPlannedService,
    andenesCount,
  } = usePlanningSelection();

  // Clear every assignment slot on the planned service — carrier, drivers,
  // truck and trailer — so reopening the sidebar for this entry starts clean.
  const removeAssignment = useCallback(
    async (serviceId: string) => {
      updateServiceAssignment(serviceId, {
        assignedCarrier: undefined,
        assignedDriver: undefined,
        assignedDriver2: undefined,
        assignedTruck: undefined,
        assignedTrailer: undefined,
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

    // View-only inspection of a planned service (left-click on chip)
    viewPlannedService,

    // Service actions (context menu, delete modals)
    ...serviceActions,
  };
}

export type UsePlanningGridReturn = ReturnType<typeof usePlanningGrid>;
