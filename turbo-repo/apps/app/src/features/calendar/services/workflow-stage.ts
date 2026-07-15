import type { BookingStatus } from "@microboxlabs/miot-calendar-client";
import type {
  PlannedWorkflowStage,
  TaskStage,
} from "@/features/calendar/components/planning/planning-selection-types";

/**
 * Kanban columns the planning calendar's live workflow index tracks. Covers
 * every ACTIVE v4 stage a booked service can be in, so a chip can show its
 * real stage from planning through monitoring. Terminal states (finished /
 * cancelled) are not queryable per-window from the live tasks API — they
 * reach the grid via the booking's lifecycle status instead
 * (see `bookingStatusToWorkflowStage`).
 */
export const CALENDAR_LIVE_TASK_COLUMNS: readonly TaskStage[] = [
  "planService",
  "assignDriver",
  "presentDriver",
  "prepareService",
  "missionControl",
  "monitorTrip",
  "confirmArrival",
  "closeMonitoring",
];

/**
 * Map a booking's lifecycle status (written by ECM, CALSYNC phases 2-3) to
 * the grid's stage vocabulary. PLANNED/ASSIGNED are deliberately absent: the
 * planning-segment look (chip + driver icons) already conveys them, and the
 * live index owns those stages anyway. IN_TRANSIT/ARRIVED map onto their
 * kanban-stage equivalents so the chip has one stage vocabulary; when a live
 * task is also present, the live answer wins upstream.
 */
const BOOKING_STATUS_TO_STAGE: Partial<
  Record<BookingStatus, PlannedWorkflowStage>
> = {
  IN_TRANSIT: "monitorTrip",
  ARRIVED: "confirmArrival",
  FINISHED: "finished",
  CANCELLED: "cancelled",
};

export function bookingStatusToWorkflowStage(
  status: BookingStatus | undefined
): PlannedWorkflowStage | undefined {
  return status ? BOOKING_STATUS_TO_STAGE[status] : undefined;
}
