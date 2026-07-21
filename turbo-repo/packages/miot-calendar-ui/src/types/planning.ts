import type { CalendarItem } from "./calendar-item";
import type { SelectedSlot } from "./calendar-slot";

/**
 * Downstream acknowledgement of a planned item's current data, host-defined
 * and orthogonal to {@link PlannedService.workflowStage}: the lifecycle can
 * advance while the external mirror is still PENDING, and a data edit can drop
 * a CONFIRMED item back to PENDING. Undefined = untracked (no external mirror,
 * or an item planned before the feature).
 */
export type SyncStatus = "PENDING" | "CONFIRMED" | "REJECTED";

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
  /**
   * Downstream sync acknowledgement of the item's current data (see
   * {@link SyncStatus}), written at load time from the booking payload.
   * Undefined = untracked. Renderers may surface it as a status dot; it does
   * not affect placement.
   */
  syncStatus?: SyncStatus;
  /** Human-readable detail for a REJECTED sync (the downstream reason). */
  syncDetail?: string;
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
