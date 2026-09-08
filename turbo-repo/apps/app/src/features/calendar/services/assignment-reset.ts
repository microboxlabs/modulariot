import type { SelectedService } from "@/features/calendar/components/planning/planning-selection-types";

/**
 * The service with its assignment dropped — what the planner hands back after
 * an unassign, and what the package then PUTs as the booking's `resource.data`.
 *
 * That PUT is why this is a list and not a shrug: every key still on the object
 * is re-asserted on the row, so a field left here survives an unassign and
 * describes an assignment that no longer holds. It mirrors ECM's
 * `CalendarSyncFeature.ASSIGNMENT_DATA_KEYS`, which erases the same set on its
 * own unassign leg — a field added there and not here comes straight back.
 *
 * `plannedIn` is deliberately not in the set: dropping the driver does not undo
 * who put the service on this calendar.
 */
export function withAssignmentCleared(
  service: SelectedService
): SelectedService {
  return {
    ...service,
    assignedIn: undefined,
    assignedCarrier: undefined,
    assignedDriver: undefined,
    assignedDriver2: undefined,
    assignedTruck: undefined,
    assignedTrailer: undefined,
    assignedCarrierAccreditation: undefined,
    assignedDriverAccreditation: undefined,
    assignedDriver2Accreditation: undefined,
    assignedTruckAccreditation: undefined,
    assignedTrailerAccreditation: undefined,
  };
}
