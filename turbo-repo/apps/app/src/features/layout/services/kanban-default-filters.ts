import {
  DEFAULT_SERVICE_TYPE,
  normalizeServiceType,
} from "@/features/calendar/services/service-types";
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
