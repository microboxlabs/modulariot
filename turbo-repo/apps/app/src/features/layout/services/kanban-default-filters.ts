import { DEFAULT_SERVICE_TYPE } from "@/features/calendar/services/service-types";
import {
  resolveSection,
  segmentsOf,
} from "../components/secured-navbar/resolve-section";

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
 * it is. No `serviceType` at all means nobody has chosen yet — the filter bar
 * writes `all` when an operator asks for every type, and that is left alone.
 */
export function defaultServiceTypeFor(
  pathname: string,
  hasServiceType: boolean
): string | undefined {
  if (hasServiceType) {
    return undefined;
  }

  const section = resolveSection(segmentsOf(pathname));
  return section && SERVICE_TYPE_SECTIONS.has(section)
    ? DEFAULT_SERVICE_TYPE
    : undefined;
}
