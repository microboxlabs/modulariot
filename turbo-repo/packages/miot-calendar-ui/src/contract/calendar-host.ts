import type { ReactNode } from "react";
import type { ClientConfig } from "@microboxlabs/miot-calendar-client";
import type { CalendarItem } from "../types/calendar-item";
import type { SelectedSlot } from "../types/calendar-slot";

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
  /** Return false to skip the package's default booking persistence. */
  shouldPersistBooking?: (item: CalendarItem, slot: SelectedSlot) => boolean;
  afterPlan?: (item: CalendarItem, slot: SelectedSlot, raw?: TRaw) => void | Promise<void>;
  afterAssign?: (item: CalendarItem, assignment: unknown) => void | Promise<void>;
  afterMove?: (item: CalendarItem, from: SelectedSlot, to: SelectedSlot) => void | Promise<void>;
  afterCancel?: (item: CalendarItem) => void | Promise<void>;
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
