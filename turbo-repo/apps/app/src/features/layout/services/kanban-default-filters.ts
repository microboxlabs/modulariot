import {
  DEFAULT_SERVICE_TYPE,
  normalizeServiceType,
} from "@/features/calendar/services/service-types";
import {
  ORIGIN_MIOT,
  parsePlannerSource,
} from "@/features/calendar/services/service-origin";
import {
  resolveSection,
  segmentsOf,
} from "@/features/layout/components/secured-navbar/resolve-section";

/** What a param with a default says for "every value, no filter". */
export const FILTER_ANY = "all";

/**
 * Sections whose boards open on one service type. The calendar planner is
 * absent on purpose: it takes its type from the calendar it is planning, and a
 * default would scope a calendar that serves every type.
 */
const SERVICE_TYPE_SECTIONS = new Set([
  "shipping",
  "delivery",
  "planning",
  "mytasks",
  "finished",
]);

/**
 * The service type a kanban URL should be given, or undefined to leave it as
 * it is.
 *
 * A choice is one of the three types, or `all` — what the filter bar writes
 * when an operator asks for every type. Anything else is nobody having chosen:
 * absent, empty, or junk from a hand-edited URL, which the API drops anyway and
 * which would otherwise sit in the URL with the badge claiming to filter by it.
 */
export function defaultServiceTypeFor(
  pathname: string,
  current: string | null | undefined
): string | undefined {
  if (current === FILTER_ANY || normalizeServiceType(current)) {
    return undefined;
  }

  const section = resolveSection(segmentsOf(pathname));
  return section && SERVICE_TYPE_SECTIONS.has(section)
    ? DEFAULT_SERVICE_TYPE
    : undefined;
}

/**
 * The planner's source filter opens on the calendar's own work: services
 * planned and assigned through it, rather than everything the sync projected
 * in. Same shape as the service type above — written into the URL so the
 * control shows what the board is filtered by, and so a filtered board stays a
 * link someone can send.
 *
 * `all` is the operator asking for everything, and must survive landing: it is
 * why the selector writes the sentinel instead of dropping the param, which
 * would put the default straight back on the next navigation.
 */
export function defaultPlannerSourceFor(
  pathname: string,
  current: string | null | undefined
): string | undefined {
  if (current === FILTER_ANY || parsePlannerSource(current)) {
    return undefined;
  }

  return resolveSection(segmentsOf(pathname)) === "calendar-planning"
    ? ORIGIN_MIOT
    : undefined;
}
