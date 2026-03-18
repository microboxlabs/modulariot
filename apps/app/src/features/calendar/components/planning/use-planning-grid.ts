"use client";

import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import {
  usePlanningSelection,
  type PlannedService,
} from "./planning-selection-context";
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
  const canPlan = isLoadingPermissions || hasPermission(["GROUP_PLANNING"]);

  const {
    selectedSlot,
    selectSlot,
    plannedServices,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    removeService,
    startReassignment,
    startAssignment,
    reassigningService,
    updateServiceDrivers,
  } = usePlanningSelection();

  // Create removeAssignment wrapper that clears driver assignments
  const removeAssignment = useCallback(
    async (serviceId: string) => {
      updateServiceDrivers(serviceId, undefined, undefined);
    },
    [updateServiceDrivers]
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

    // Planned services
    plannedServices,
    getPlannedServicesForSlot,

    // Slot state helpers
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,

    // Reassignment
    reassigningService,

    // Service actions (context menu, delete modals)
    ...serviceActions,
  };
}

export type UsePlanningGridReturn = ReturnType<typeof usePlanningGrid>;
