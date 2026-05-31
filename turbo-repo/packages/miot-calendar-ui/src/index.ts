// Public entry for @microboxlabs/miot-calendar-ui.
//
// The reusable, domain-agnostic calendar UI surface is extracted here across
// phases P1–P6 (see .cursor/plans/calendar-ui-package-extraction.plan.md).

/** Package marker. */
export const MIOT_CALENDAR_UI_VERSION = "0.1.0";

// Time-window primitives: the canonical TimeSlot/TimeWindow/TimeBlock config
// model, color presets, type guards, and pattern/quota utilities.
export * from "./components/planning/time-window";

// Pure grid geometry: shift-rectangle layout + variable-row stretching.
export * from "./components/planning/shift-layout";

// Slot-cell styling helpers (Tailwind class derivation, blocked/spare stripes).
export * from "./components/planning/planning-slot-utils";

// Display formatting helpers.
export * from "./components/planning/planning-format";

// Calendar URL/view-mode + time-axis slot utilities.
export * from "./services/calendar.service";
// The time-axis slot ({hour, minutes, label}) is distinct from the time-window
// config TimeSlot above; surface it under an unambiguous name to avoid a clash.
export type { TimeSlot as TimeAxisSlot, ViewMode } from "./services/calendar.service.types";

// API <-> local time-window mapping + the response validation schema.
export * from "./services/time-window.service";

// Time-slot request/response DTOs.
export * from "./types/time-slot.types";

// ── Phase 2: canonical item model + host contract + default components ──

// The canonical, domain-agnostic descriptor of a listed/planned element.
export * from "./types/calendar-item";
// A selected grid slot (date + time-of-day + optional platform).
export * from "./types/calendar-slot";
// The single contract a host implements to mount the calendar.
export * from "./contract/calendar-host";
// Booking CRUD surface + persist-decision context the host wires in.
export * from "./contract/booking-api";
// Generic planned/reassigning/assigning item models.
export * from "./types/planning";
// Generic booking request/resource builders + optimistic rollback.
export * from "./services/booking-persistence";
// Default sidebar card + grid chip rendered from a CalendarItem.
export * from "./components/item-card";
export * from "./components/item-chip";
// Generic calendar UI state provider + hooks (domain logic layered on later).
export * from "./context/calendar-provider";
// Generic planning-selection provider: selection state + booking CRUD core.
export * from "./context/planning-selection-context";
