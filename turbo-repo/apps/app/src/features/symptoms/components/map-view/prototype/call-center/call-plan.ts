/**
 * The "A quién llamar" list: the level's operator steps in order, each with
 * the book contacts its target resolves to, then everyone else in the book.
 */

import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type {
  TowerTreatment,
  TowerTripContacts,
} from "@/features/symptoms/control-tower/control-tower-api";
import {
  isCarrierContact,
  roleKey,
  stepTarget,
  type StepTarget,
} from "@/features/symptoms/control-tower/contact-roles";
import type { Step } from "@/features/symptoms/maintainer/maintainer-api";
import { type CallTarget, targetIdOfAction } from "./call-targets";

export interface CallGroup {
  index: number;
  step: Step;
  /** Who the step contacts; null when the step does not say. */
  target: StepTarget | null;
  /** Not yet called first; called in this case after, oldest call first. */
  targets: CallTarget[];
}

export interface CallPlan {
  groups: CallGroup[];
  /** Contacts no step points to. With no steps, every target. */
  others: CallTarget[];
}

/** The book contacts of the case's trip, as the server matched them by RUT. */
export interface TripMatches {
  drivers: ReadonlySet<string>;
  carrierContacts: ReadonlySet<string>;
}

export const NO_TRIP_MATCHES: TripMatches = {
  drivers: new Set(),
  carrierContacts: new Set(),
};

export function tripMatches(view: TowerTripContacts | undefined): TripMatches {
  if (!view) return NO_TRIP_MATCHES;
  return {
    drivers: new Set(view.drivers),
    carrierContacts: new Set(view.carrierContacts),
  };
}

/**
 * When each contact was last called in the case, by stable contact id.
 * A legacy role-only call cannot identify a driver assigned later.
 */
export function calledInCase(
  treatments: readonly TowerTreatment[] | undefined
): Map<string, Date> {
  const out = new Map<string, Date>();
  const mark = (id: string, at: Date) => {
    const previous = out.get(id);
    if (!previous || previous < at) out.set(id, at);
  };
  for (const t of treatments ?? []) {
    for (const action of t.actions) {
      const id = targetIdOfAction(action);
      if (!id || !action.contactId) continue;
      const at = new Date(action.performedAt);
      mark(id, at);
    }
  }
  return out;
}

function calledLast(
  targets: CallTarget[],
  called: ReadonlyMap<string, Date>
): CallTarget[] {
  const pending = targets.filter((t) => !called.has(t.id));
  const done = targets
    .filter((t) => called.has(t.id))
    .sort((a, b) => called.get(a.id)!.getTime() - called.get(b.id)!.getTime());
  return [...pending, ...done];
}

/** The book contacts a step's target resolves to. */
export function targetsOfStep(
  target: StepTarget | null,
  targets: readonly CallTarget[],
  trip: TripMatches
): CallTarget[] {
  if (!target) return [];
  if (target.scope === "DRIVER") {
    return targets.filter((t) => trip.drivers.has(t.id));
  }
  const key = roleKey(target.role);
  if (target.scope === "TRIP_CARRIER") {
    return targets.filter(
      (t) => trip.carrierContacts.has(t.id) && (!key || roleKey(t.role) === key)
    );
  }
  if (!key) return [];
  return targets.filter((t) => !isCarrierContact(t) && roleKey(t.role) === key);
}

export function callPlan(
  steps: readonly Step[],
  targets: readonly CallTarget[],
  called: ReadonlyMap<string, Date> = new Map(),
  trip: TripMatches = NO_TRIP_MATCHES
): CallPlan {
  const grouped = new Set<string>();
  const groups = steps.map((step, index) => {
    const target = stepTarget(step.role, step.scope);
    const members = targetsOfStep(target, targets, trip);
    for (const t of members) grouped.add(t.id);
    return { index, step, target, targets: calledLast(members, called) };
  });
  const others = calledLast(
    targets.filter((t) => !grouped.has(t.id)),
    called
  );
  return { groups, others };
}

/** Matches name, role or, for a query with digits, the phone. */
export function matchesTarget(target: CallTarget, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return (
    target.personName.toLowerCase().includes(q) ||
    target.role.toLowerCase().includes(q) ||
    (digits.length > 0 && target.phone.replace(/\D/g, "").includes(digits))
  );
}

/** Fills a step's script with the case's values; unknown variables stay as written. */
export function fillScript(
  script: string,
  treatment: TreatmentsGeneralResponseItem | null
): string {
  const trip = treatment?.trip_info;
  const values: Record<string, string | undefined> = {
    conductor: trip?.driver,
    patente: trip?.asset_id,
    ruta: trip ? `${trip.origin} → ${trip.destination}` : undefined,
  };
  return script.replaceAll(
    /\{\{\s*(\w+)\s*\}\}/g,
    (all, name: string) => values[name] ?? all
  );
}

/** Which step is due after `elapsedSeconds`, by the steps' cumulative minutes. */
export function stepAt(steps: readonly Step[], elapsedSeconds: number): number {
  let end = 0;
  for (let i = 0; i < steps.length; i++) {
    end += (steps[i].budgetMinutes ?? 0) * 60;
    if (elapsedSeconds < end) return i;
  }
  return steps.length - 1;
}
