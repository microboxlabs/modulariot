// --- Enum ---

/**
 * - `OPEN` — bookable.
 * - `FULL` — at capacity.
 * - `CLOSED` — blocked (BLOCK time window).
 * - `OVERFLOW` — generated beyond the time window's bookable quota (MANUAL slot generation):
 *   rendered in the planner but carries zero capacity and bookings against it are rejected.
 */
export type SlotStatus = "OPEN" | "FULL" | "CLOSED" | "OVERFLOW";

/**
 * How a time window's slot duration is determined.
 *
 * - `AUTO` — derived from the capacity model (`ceil(capacity / parallelism)` slots; duration =
 *   windowMinutes / numberOfSlots); every generated slot is bookable.
 * - `MANUAL` — `slotDurationMinutes` is admin-set; the window is filled with
 *   `floor(windowMinutes / slotDurationMinutes)` slots, of which the first `ceil(capacity / parallelism)`
 *   are bookable and the rest are `OVERFLOW`.
 */
export type SlotGenerationMode = "AUTO" | "MANUAL";

// --- Shared data types ---

export interface ResourceData {
  id: string;
  type?: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface SlotData {
  date: string;
  hour: number;
  minutes: number;
}

// --- Bookings ---

export interface BookingRequest {
  calendarId: string;
  resource: ResourceData;
  slot: SlotData;
  /**
   * Existing booking id to exclude from the window-capacity count. Used during
   * reassignment: the new booking is created before the old one is cancelled,
   * so the validator would otherwise count the moved booking twice and reject
   * any window-internal move into a full window.
   */
  excludeBookingId?: string;
}

export interface BookingUpdateRequest {
  resource: ResourceData;
}

export interface BookingResponse {
  id: string;
  calendarId: string;
  resource: ResourceData;
  slot: SlotData;
  createdAt: string;
  createdBy?: string;
}

export interface BookingListResponse {
  data: BookingResponse[];
  total: number;
}

// --- Calendar Groups ---

export interface CalendarGroupRequest {
  code: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface CalendarGroupResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Calendars ---

export interface CalendarFilter {
  origin?: string;
  destination?: string;
}

export interface CalendarRequest {
  code: string;
  name: string;
  description?: string;
  timezone?: string;
  active?: boolean;
  parallelism?: number;
  groups?: string[];
  filter?: CalendarFilter;
  autoSlotManager?: boolean;
}

export interface CalendarResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  timezone: string;
  active: boolean;
  parallelism: number;
  createdAt: string;
  updatedAt: string;
  groups?: CalendarGroupResponse[];
  filter?: CalendarFilter;
  hasSlotManager?: boolean;
}

// --- Time Windows ---

/**
 * Discriminator for a time window.
 *
 * - `WINDOW` — bookable period with a capacity quota (the historical default).
 * - `BLOCK`  — non-bookable period (holiday, maintenance, manual closure);
 *   slot generation produces CLOSED slots so the planning UI can paint them
 *   and the backend rejects bookings against them.
 */
export type TimeWindowKind = "WINDOW" | "BLOCK";

export interface TimeWindowRequest {
  name: string;
  startHour: number;
  endHour: number;
  validFrom: string;
  capacity?: number;
  daysOfWeek?: string;
  validTo?: string;
  active?: boolean;
  color?: string;
  /** Defaults to `WINDOW` server-side when omitted. */
  kind?: TimeWindowKind;
  /** Defaults to `MANUAL` server-side when omitted. Ignored for `BLOCK` windows. */
  slotGenerationMode?: SlotGenerationMode;
  /**
   * Slot length in minutes. Required only when `slotGenerationMode` is `MANUAL` on a `WINDOW`; if
   * omitted there it is seeded server-side from the capacity model. Ignored for `AUTO` and `BLOCK`.
   * Must be between 5 and the window length in minutes.
   */
  slotDurationMinutes?: number;
}

export interface TimeWindowResponse {
  id: string;
  calendarId: string;
  name: string;
  startHour: number;
  endHour: number;
  /** Admin-set when `slotGenerationMode` is `MANUAL`; derived from the capacity model otherwise. */
  slotDurationMinutes: number;
  capacity: number;
  daysOfWeek: string;
  validFrom: string;
  validTo?: string;
  active: boolean;
  color?: string;
  kind: TimeWindowKind;
  slotGenerationMode: SlotGenerationMode;
  /** Total slots generated across the window (`floor(windowMinutes / slotDurationMinutes)` in MANUAL mode; 0 for BLOCK). */
  totalSlots: number;
  /** How many of the generated slots are bookable (`OPEN`); the remainder, up to `totalSlots`, are `OVERFLOW`. */
  bookableSlots: number;
  createdAt: string;
  updatedAt: string;
}

// --- Slots ---

export interface GenerateSlotsRequest {
  calendarId: string;
  startDate: string;
  endDate: string;
}

export interface GenerateSlotsResponse {
  slotsCreated: number;
  slotsSkipped: number;
  message: string;
}

export interface SlotResponse {
  id: string;
  calendarId: string;
  timeWindowId?: string;
  slotDate: string;
  slotHour: number;
  slotMinutes: number;
  capacity: number;
  currentOccupancy: number;
  availableCapacity: number;
  status: SlotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SlotListResponse {
  data: SlotResponse[];
  total: number;
}

export interface UpdateSlotStatusRequest {
  status: SlotStatus;
}

// --- Slot Managers ---

export interface SlotManagerRequest {
  calendarId: string;
  active?: boolean;
  daysInAdvance?: number;
  batchDays?: number;
  reprocessFrom?: string;
  reprocessTo?: string;
}

export interface SlotManagerResponse {
  id: string;
  calendarId: string;
  calendarCode: string;
  calendarName: string;
  active: boolean;
  daysInAdvance: number;
  batchDays: number;
  reprocessFrom?: string;
  reprocessTo?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunError?: string;
  generatedThrough?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlotManagerRunResponse {
  id: string;
  managerId: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  slotsCreated: number;
  slotsSkipped: number;
  generatedFrom?: string;
  generatedThrough?: string;
  errorMessage?: string;
}

// --- Error ---

export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
}

// --- Client config ---

export interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}
