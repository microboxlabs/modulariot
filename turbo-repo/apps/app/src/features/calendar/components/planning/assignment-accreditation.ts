// Aggregates the per-resource accreditation levels persisted on a planned
// service's assignment tuple into the single "weakest link" level the
// calendar surfaces (service card, planned chip) render.

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  accreditationLabel,
  type AccreditationLevel,
} from "./sidebar-tabs/assignment/accreditation";
import type { SelectedService } from "./planning-selection-types";

/** Ordering used to pick the weakest level across the assigned resources. */
const LEVEL_RANK: Record<AccreditationLevel, number> = {
  notAccredited: 0,
  accredited: 1,
  superAccredited: 2,
};

export interface AssignmentAccreditationEntry {
  /** i18n key of the resource slot label (Transportista, Conductor, …). */
  labelKey: string;
  level: AccreditationLevel;
}

export interface AssignmentAccreditation {
  /**
   * Weakest level across the assigned resources — a service is only as
   * accredited as its least-accredited resource, so `superAccredited` means
   * every assigned resource is super accredited.
   */
  level: AccreditationLevel;
  /** Per-resource breakdown, in carrier → driver → truck → trailer order. */
  entries: AssignmentAccreditationEntry[];
}

/**
 * Collect the accreditation levels persisted on a service's assignment tuple.
 * Slots that are unassigned — or assigned before the level was captured
 * (legacy bookings persist ids only, and `null` means the row wasn't on the
 * loaded feed page at selection time) — are skipped rather than treated as
 * `notAccredited`, so "unknown" never masquerades as a real state. Returns
 * null when nothing is known and no badge should render.
 */
export function getAssignmentAccreditation(
  service: SelectedService
): AssignmentAccreditation | null {
  const entries: AssignmentAccreditationEntry[] = [];
  const collect = (
    assignedId: string | undefined,
    level: AccreditationLevel | null | undefined,
    labelKey: string
  ) => {
    if (assignedId && level != null) entries.push({ labelKey, level });
  };
  collect(
    service.assignedCarrier,
    service.assignedCarrierAccreditation,
    "pages.planning.sidebar.assignment.carrier"
  );
  collect(
    service.assignedDriver,
    service.assignedDriverAccreditation,
    "pages.planning.sidebar.assignment.driver"
  );
  collect(
    service.assignedDriver2,
    service.assignedDriver2Accreditation,
    "pages.planning.sidebar.assignment.secondDriver"
  );
  collect(
    service.assignedTruck,
    service.assignedTruckAccreditation,
    "pages.planning.sidebar.assignment.truck"
  );
  collect(
    service.assignedTrailer,
    service.assignedTrailerAccreditation,
    "pages.planning.sidebar.assignment.trailer"
  );
  if (entries.length === 0) return null;
  let weakest = entries[0].level;
  for (const entry of entries) {
    if (LEVEL_RANK[entry.level] < LEVEL_RANK[weakest]) weakest = entry.level;
  }
  return { level: weakest, entries };
}

/**
 * Per-resource breakdown for the badge tooltip — one "<slot>: <level>" line
 * per assigned resource with a known level.
 */
export function assignmentAccreditationTooltip(
  summary: AssignmentAccreditation,
  dict: I18nRecord
): string {
  return summary.entries
    .map(
      (entry) =>
        `${tr(entry.labelKey, dict)}: ${accreditationLabel(entry.level, dict)}`
    )
    .join("\n");
}
