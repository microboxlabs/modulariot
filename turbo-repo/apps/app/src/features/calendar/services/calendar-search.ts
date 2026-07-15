import type { SelectedService } from "@/features/calendar/components/planning/planning-selection-types";

/**
 * How far either side of **today** the search sweeps, in days.
 *
 * Sized to match the window the grid already loads for one calendar
 * (planning-selection-wrapper's bookingsRange) — search just sweeps it across
 * every calendar instead of one, so the payload is a known multiple of a cost
 * the product already accepts rather than a guess at the planning horizon.
 *
 * Anchored on today rather than the viewed date so the window holds still while
 * the user steps through matches; see the rationale in use-calendar-search.
 *
 * The cost of that choice: a service planned outside this window is not found.
 * Widening it is a one-line change here, but the honest fix is a server-side
 * query (the bookings API has no `q` param and no pagination today).
 */
export const SEARCH_WINDOW_DAYS = 30;

/**
 * Orders search matches so each calendar's matches are contiguous, sorted by
 * time within a calendar, with calendars ordered by their earliest match.
 *
 * This is what makes stepping through results bearable. Crossing between
 * calendars changes the `[calendarId]` route segment, which remounts the grid
 * and refetches its bookings — a visible reset. A plain chronological order
 * interleaves calendars and pays that cost on nearly every step; grouping pays
 * it only once per calendar boundary.
 *
 * Ordering calendars by earliest match (not by the calendar currently on
 * screen) keeps the order — and the "n of m" counter — stable no matter which
 * calendar the user has navigated into. Does not mutate the input.
 */
export function orderMatchesByCalendar<T extends { calendarId: string }>(
  items: readonly T[],
  timeOf: (item: T) => number
): T[] {
  const earliest = new Map<string, number>();
  for (const item of items) {
    const t = timeOf(item);
    const prev = earliest.get(item.calendarId);
    if (prev === undefined || t < prev) earliest.set(item.calendarId, t);
  }
  return [...items].sort((a, b) => {
    if (a.calendarId !== b.calendarId) {
      return (
        (earliest.get(a.calendarId) ?? 0) - (earliest.get(b.calendarId) ?? 0)
      );
    }
    return timeOf(a) - timeOf(b);
  });
}

/**
 * Whether a service's resource tuple is complete.
 *
 * Carrier + driver + truck is the tuple the assignment actually requires —
 * `buildAssignProcessVariables` (task-driven-assign) refuses to build unless
 * all three are present, and treats the trailer as nullable. So the trailer is
 * deliberately not part of this verdict.
 */
export type AssignmentState = "unassigned" | "partial" | "assigned";

export function assignmentStateOf(service: SelectedService): AssignmentState {
  const core = [
    service.assignedCarrier,
    service.assignedDriver,
    service.assignedTruck,
  ];
  const filled = core.filter(Boolean).length;
  if (filled === 0) return "unassigned";
  if (filled === core.length) return "assigned";
  return "partial";
}

export interface CalendarSearchParams {
  /** Matched against the display id and the stable service code. */
  service: string[];
  customer: string[];
  origin: string[];
  destination: string[];
  /** Matched against the truck and trailer plates. */
  licensePlate: string[];
  tipoViaje: string[];
  assignment: AssignmentState[];
}

const ASSIGNMENT_STATES: readonly string[] = [
  "unassigned",
  "partial",
  "assigned",
];

/**
 * Both the text and the select badges write comma-joined values (text badges
 * accumulate chips on Enter), so every param parses as a list.
 */
function list(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseCalendarSearchParams(
  searchParams: URLSearchParams
): CalendarSearchParams {
  return {
    service: list(searchParams.get("service")),
    customer: list(searchParams.get("customer")),
    origin: list(searchParams.get("origin")),
    destination: list(searchParams.get("destination")),
    licensePlate: list(searchParams.get("licensePlate")),
    tipoViaje: list(searchParams.get("tipoViaje")),
    assignment: list(searchParams.get("assignment")).filter(
      (v): v is AssignmentState => ASSIGNMENT_STATES.includes(v)
    ),
  };
}

export function isCalendarSearchActive(params: CalendarSearchParams): boolean {
  return Object.values(params).some((v) => v.length > 0);
}

/** Case-insensitive substring match against any of the candidate fields. */
function matchesAny(
  terms: string[],
  fields: (string | null | undefined)[]
): boolean {
  if (terms.length === 0) return true; // an unset param constrains nothing
  const haystack = fields
    .filter((f): f is string => Boolean(f))
    .map((f) => f.toLowerCase());
  // Terms within one param are OR-ed: the badge's chips read as "any of these".
  return terms.some((term) => {
    const needle = term.toLowerCase();
    return haystack.some((f) => f.includes(needle));
  });
}

/**
 * Does this planned service match the active search?
 *
 * Params AND together (each badge narrows), terms within a param OR together
 * (a badge's chips are alternatives). An unset param constrains nothing, so an
 * empty search matches *every* service — callers must gate on
 * `isCalendarSearchActive` rather than relying on this to return false.
 */
export function matchesCalendarSearch(
  service: SelectedService,
  params: CalendarSearchParams
): boolean {
  return (
    matchesAny(params.service, [service.id, service.mintral_serviceCode]) &&
    matchesAny(params.customer, [service.cliente]) &&
    matchesAny(params.origin, [service.origen]) &&
    matchesAny(params.destination, [service.destino]) &&
    matchesAny(params.licensePlate, [
      service.assignedTruckExternalId,
      service.assignedTrailerExternalId,
    ]) &&
    // Trip type and assignment are exact-value selects, not substrings.
    (params.tipoViaje.length === 0 ||
      params.tipoViaje.includes(service.tipoViaje)) &&
    (params.assignment.length === 0 ||
      params.assignment.includes(assignmentStateOf(service)))
  );
}
