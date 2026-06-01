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

// ── Phase 4 (PASS 1): grid-core shell components ──

// Standardized confirmation dialog (labels translated host-side).
export * from "./components/confirmation-modal";
// Time-axis label + slot-cell indicator pieces (badges, quota, blocked mark).
export * from "./components/planning/slot-cell-shared";
// Reassignment connector overlay (origin → target slot line + arrow).
export * from "./components/planning/reassignment-connector";
// Delete-confirmation modal + i18n-seam message builders.
export * from "./components/planning/delete-confirmation-modal";
// Shift overlay layer: per-shift rectangles + chips (chip render-prop seam).
export * from "./components/planning/shift-overlay-layer";
// Root grid overlays: host context menu + delete modals + reassign connector.
export * from "./components/planning/planning-grid-overlays";
// Grid shell: scroll container + overlay mount points (view markup as children).
export * from "./components/planning/planning-grid-shell";

// ── Phase 4 (PASS 2): nav + view shell components ──

// Presentational "today" button (label + handler injected by the host).
export * from "./components/planning/calendar-navigation";
// Presentational day/week/month switcher (active view + handler injected).
export * from "./components/planning/calendar-view-switcher";
// View seam types: injected grid controller + shell-props builder + view props.
export * from "./components/planning/planning-views.types";
// Single-day axis grid (host injects grid data + shell-props builder).
export * from "./components/planning/day/day-grid";
// Day view: reads the active date from useCalendar() and renders the day grid.
export * from "./components/planning/planning-day-view";
// Week view: 7-day shift grid (host injects grid data + shell-props builder).
export * from "./components/planning/planning-week-view";
// Month view: day-cell grid; chips via the renderDayChip render-prop seam.
export * from "./components/planning/planning-month-view";
// Calendar switch: renders day/week/month from the useCalendar() active view.
export * from "./components/planning/planning-calendar";

// ── Phase 4 (PASS 3): sidebar shell + search components ──

// Generic grouped-autocomplete search box (fields + i18n injected by the host).
export * from "./components/planning/planning-search-autocomplete";
// Generic active-filter chip list (match-type labels resolved by the host).
export * from "./components/planning/planning-search-tags";
