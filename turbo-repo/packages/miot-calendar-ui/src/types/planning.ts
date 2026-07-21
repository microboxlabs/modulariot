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
  /**
   * Live workflow stage of the planned item, host-defined (e.g. a kanban
   * column key or a terminal state such as "finished"). Populated two ways:
   * a terminal value may be written at load time from the booking payload,
   * and the provider overlays {@link CalendarHost.resolveWorkflowStage} at
   * render time so a live-index refresh re-labels chips without a booking
   * refetch. Undefined = no known stage; renderers fall back to the plain
   * planned look.
   */
  workflowStage?: string;
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
