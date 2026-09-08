import { normalizeServiceType } from "./service-types";
import type { PlanningSearchMatchType } from "../components/planning/planning-search-match-type";

export interface PlanningSearchTag {
  matchType: PlanningSearchMatchType;
  value: string;
  /** Comes from the calendar being planned, so the operator cannot drop it. */
  locked?: boolean;
}

/** The calendar fields that decide which services it can take at all. */
export interface CalendarPlanningFilter {
  origin?: string | null;
  destination?: string | null;
  serviceType?: string | null;
}

/**
 * The chips a calendar imposes on its own planning sidebar. They are its
 * configuration, not a search: an ANF/`otr` calendar listing MEL or `v`
 * services would offer as plannable exactly what it cannot take.
 */
export function lockedTagsForCalendar(
  filter: CalendarPlanningFilter | null | undefined
): PlanningSearchTag[] {
  const tags: PlanningSearchTag[] = [];

  if (filter?.origin) {
    tags.push({ matchType: "origen", value: filter.origin, locked: true });
  }
  if (filter?.destination) {
    tags.push({
      matchType: "destino",
      value: filter.destination,
      locked: true,
    });
  }
  const serviceType = normalizeServiceType(filter?.serviceType);
  if (serviceType) {
    tags.push({ matchType: "tipoServicio", value: serviceType, locked: true });
  }

  return tags;
}

/** Whether the calendar already fixes this field, leaving nothing to search. */
export function isMatchTypeLocked(
  tags: readonly PlanningSearchTag[],
  matchType: PlanningSearchMatchType
): boolean {
  return tags.some((tag) => tag.locked && tag.matchType === matchType);
}

/**
 * `next` with the locked chips restored, in front and in their original order.
 * Every path that rewrites the chips — removing one, clearing the search — goes
 * through here, so none of them can drop a constraint the calendar imposes.
 */
export function withLockedTags(
  next: readonly PlanningSearchTag[],
  current: readonly PlanningSearchTag[]
): PlanningSearchTag[] {
  const locked = current.filter((tag) => tag.locked);
  if (locked.length === 0) {
    return [...next];
  }

  const lockedKeys = new Set(locked.map((tag) => tag.matchType));
  return [...locked, ...next.filter((tag) => !lockedKeys.has(tag.matchType))];
}
