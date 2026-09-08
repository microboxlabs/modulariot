/**
 * Where a booked service was planned and assigned — this module, or the
 * upstream sync that projects services in on its own.
 *
 * Creation cannot answer that question: every service is created by the sync,
 * and the booking row's `created_by` names the service that wrote it, not who
 * decided it. The plan and assign transitions can, and ecm-coordinator stamps
 * each onto `resource.data` as it happens (`plannedIn` / `assignedIn`).
 */

/** Value both stamps use for "an operator drove this through the module". */
export const ORIGIN_MIOT = "miot";

/** The three states of the planner's source filter; absent = no filter. */
export const PLANNER_SOURCES = ["miot", "synced"] as const;
export type PlannerSource = (typeof PLANNER_SOURCES)[number];

/** The `source` URL param, or undefined for "all" (junk reads as all). */
export function parsePlannerSource(
  raw: string | null | undefined
): PlannerSource | undefined {
  return PLANNER_SOURCES.find((source) => source === raw);
}

/**
 * Whether an operator drove either event here. Either stamp is enough on
 * purpose: a service the sync placed and an operator then assigned is the
 * assigning planner's work, and one they planned stays theirs after the sync
 * reassigns it away.
 *
 * Both keys absent is what every booking written before the stamp looks like,
 * and what the sync's own bookings look like — so absent reads as synced.
 */
export function isPlannedInModule(service: {
  plannedIn?: string;
  assignedIn?: string;
}): boolean {
  return service.plannedIn === ORIGIN_MIOT || service.assignedIn === ORIGIN_MIOT;
}

/** Whether a service belongs in the grid under the current filter. */
export function matchesPlannerSource(
  service: { plannedIn?: string; assignedIn?: string },
  source: PlannerSource | undefined
): boolean {
  if (!source) return true;
  return isPlannedInModule(service) === (source === ORIGIN_MIOT);
}
