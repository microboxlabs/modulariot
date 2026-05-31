import type { ReactNode } from "react";
import type { ClientConfig } from "@microboxlabs/miot-calendar-client";
import type { CalendarItem } from "../types/calendar-item";
import type { SelectedSlot } from "../types/calendar-slot";
import type { BookingApi, BookingPersistContext } from "./booking-api";

/** Translate function injected by the host (e.g. the app's i18n `tr`). */
export interface CalendarI18n {
  dict: unknown;
  tr: (path: string, dict: unknown, params?: Record<string, unknown>) => string;
}

export interface CalendarNotification {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

/** Capability flags the host derives from its auth/permissions. */
export interface CalendarPermissions {
  canPlan: boolean;
  canAssign: boolean;
  canView: boolean;
}

/**
 * Lifecycle hooks the host plugs in so domain side-effects (workflow advance,
 * binding notifications, category sync) and special persistence cases — e.g.
 * task-driven origins that must NOT POST a booking (the backend writes the row)
 * — stay host-side. The package owns the generic booking persistence; these
 * hooks let the host intercept or supplement it.
 */
export interface CalendarHooks<TRaw = unknown> {
  /**
   * Return false to skip the package's default booking persistence (the
   * task-driven origins whose backend listener writes the row itself). The
   * `ctx` carries the core's `oldBookingId`/`isReassigning` so the host can
   * recompute the task-driven decision without owning the selection state.
   */
  shouldPersistBooking?: (
    item: CalendarItem,
    slot: SelectedSlot,
    ctx: BookingPersistContext
  ) => boolean;
  /**
   * Post-persist domain side-effects for a plan/assign confirm: category sync,
   * workflow task advance. For task-driven origins (`shouldPersistBooking` →
   * false) it runs in place of the skipped POST, so the task advance happens
   * before any row write; for legacy origins it runs AFTER the booking POST
   * (with `ctx.booking` set to the freshly written row).
   */
  afterPlan?: (
    item: CalendarItem,
    slot: SelectedSlot,
    ctx: BookingPersistContext
  ) => void | Promise<void>;
  afterAssign?: (
    item: CalendarItem,
    assignment: unknown
  ) => void | Promise<void>;
  afterMove?: (
    item: CalendarItem,
    from: SelectedSlot,
    to: SelectedSlot
  ) => void | Promise<void>;
  /**
   * Pre-cancel reversal for a full unplan: reverse the workflow task + notify
   * the host binding. Runs BEFORE the package cancels the booking; throwing
   * aborts the removal so the item stays visible and the user can retry.
   */
  afterCancel?: (item: CalendarItem) => void | Promise<void>;
  /**
   * Clear-assignment reversal: reverse the workflow task + notify the binding
   * (domain), then return the host item with its assignment tuple cleared so
   * the package can rewrite the booking resource and local state. Throwing
   * aborts the unassignment so the tuple stays visible.
   */
  onUnassign?: (raw: TRaw) => TRaw | Promise<TRaw>;
}

/** Context handed to a host-provided assign panel renderer. */
export interface AssignPanelContext {
  item: CalendarItem;
  slot: SelectedSlot | null;
}

/**
 * The single contract the host provides to mount the calendar. Everything
 * domain-specific — data-source config, card/chip overrides, the assign UI,
 * workflow hooks, i18n, notifications, permissions — flows through here so the
 * package itself stays domain-agnostic.
 */
export interface CalendarHost<TRaw = unknown> {
  /** miot-calendar-client config; the package builds the client internally. */
  client: ClientConfig;
  /** The calendar this host instance operates on. */
  calendarId: string;
  /** Map a host domain object to the canonical CalendarItem. */
  toItem: (raw: TRaw) => CalendarItem;
  /**
   * Booking CRUD. When omitted the package builds a default from `client` via
   * `createMiotCalendarClient`; hosts that proxy through their own backend
   * (and drive workflow side-effects) override it.
   */
  bookingApi?: BookingApi;
  /**
   * Resolve the host's *live* workflow task for an item by its stable business
   * code. Undefined when the host has no workflow, or no active task for the
   * item. `stage` is host-defined (e.g. a kanban column key).
   */
  getLiveTask?: (
    serviceCode: string | undefined
  ) => { taskId: string; stage: string } | undefined;
  /** Override the default sidebar card. */
  renderItemCard?: (item: CalendarItem) => ReactNode;
  /** Override the default grid chip. */
  renderItemChip?: (item: CalendarItem) => ReactNode;
  /** Optional assign panel — the assign flow is opt-in. */
  assignPanel?: ReactNode | ((ctx: AssignPanelContext) => ReactNode);
  hooks?: CalendarHooks<TRaw>;
  i18n: CalendarI18n;
  notify: (n: CalendarNotification) => void;
  permissions: CalendarPermissions;
}
