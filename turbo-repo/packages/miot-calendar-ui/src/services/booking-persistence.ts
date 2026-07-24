import type { Dispatch, SetStateAction } from "react";
import dayjs from "dayjs";
import type {
  BookingRequest,
  MoveBookingRequest,
  ResourceData,
} from "@microboxlabs/miot-calendar-client";
import type { CalendarItem } from "../types/calendar-item";
import type { SelectedSlot } from "../types/calendar-slot";
import type { PlannedService } from "../types/planning";

/**
 * Booking resource type tag. Kept as a stable constant so the persisted
 * `cld_bookings.resource.type` shape is identical across hosts.
 */
const RESOURCE_TYPE = "service";

/**
 * Build the booking resource payload for a calendar item placed in a slot. The
 * item's opaque `raw` host object is spread into `data` so planner-side
 * overrides (category, assignment tuple, …) round-trip on the same write;
 * `_anden` is stored alongside because SlotData has no platform field.
 */
export function buildResource(
  item: CalendarItem,
  slot: SelectedSlot
): ResourceData {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  return {
    id: item.id,
    type: RESOURCE_TYPE,
    label: item.title,
    data: {
      ...raw,
      ...(slot.anden === undefined ? {} : { _anden: slot.anden }),
    },
  };
}

/** Build a create-booking request for an item placed in a slot. */
export function buildBookingRequest(
  calendarId: string,
  item: CalendarItem,
  slot: SelectedSlot
): BookingRequest {
  return {
    calendarId,
    resource: buildResource(item, slot),
    slot: {
      date: dayjs(slot.date).format("YYYY-MM-DD"),
      hour: slot.hour,
      minutes: slot.minutes,
    },
  };
}

/**
 * Build the move payload for an existing booking — the target slot plus a fresh
 * resource snapshot, so planner-side overrides land in the same atomic write.
 */
export function buildMoveRequest(
  item: CalendarItem,
  slot: SelectedSlot
): MoveBookingRequest {
  return {
    slot: {
      date: dayjs(slot.date).format("YYYY-MM-DD"),
      hour: slot.hour,
      minutes: slot.minutes,
    },
    resource: buildResource(item, slot),
  };
}

/**
 * The entry a failed confirm must restore: what this item looked like before
 * the optimistic replace. The reassignment snapshot wins because it alone
 * carries the pre-move slot; otherwise the item's current entry, which is what
 * an assignment edits in place. Null only when the item was not planned yet —
 * there, dropping the optimistic entry IS the restore.
 *
 * Getting this wrong erases an item that is still planned: a confirm that
 * throws has written nothing, so the row survives and only the grid forgets it.
 */
export function preEditSnapshot<TItem extends { id: string }>(
  plannedServices: readonly PlannedService<TItem>[],
  itemId: string,
  reassignSnapshot: PlannedService<TItem> | null
): PlannedService<TItem> | null {
  if (reassignSnapshot) return reassignSnapshot;
  return plannedServices.find((p) => p.service.id === itemId) ?? null;
}

/**
 * Restore plannedServices after a failed persist: drop the optimistic entry
 * and re-add the pre-edit snapshot (see {@link preEditSnapshot}) when present.
 */
export function rollbackPlannedService<TItem extends { id: string }>(
  setPlannedServices: Dispatch<SetStateAction<PlannedService<TItem>[]>>,
  itemId: string,
  original: PlannedService<TItem> | null
): void {
  setPlannedServices((prev) => {
    const withoutNew = prev.filter((p) => p.service.id !== itemId);
    return original ? [...withoutNew, original] : withoutNew;
  });
}
