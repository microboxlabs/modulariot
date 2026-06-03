import type { CalendarItem } from "./calendar-item";
import type { SelectedSlot } from "./calendar-slot";

/**
 * A host item that has been confirmed and placed into a grid slot. Generic over
 * the host's domain item type (defaults to the canonical {@link CalendarItem});
 * the package only relies on the item carrying a stable `id`.
 */
export interface PlannedService<TItem extends { id: string } = CalendarItem> {
  service: TItem;
  slot: SelectedSlot;
}

/** A planned item being reassigned, with its original slot for restoration. */
export interface ReassigningService<
  TItem extends { id: string } = CalendarItem,
> {
  service: PlannedService<TItem>;
  originalSlot: SelectedSlot;
}

/** A planned item opened in assignment-only mode (only the assign tab). */
export interface AssigningService<TItem extends { id: string } = CalendarItem> {
  service: PlannedService<TItem>;
}
