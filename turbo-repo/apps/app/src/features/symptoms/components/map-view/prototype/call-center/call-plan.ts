/**
 * The "A quién llamar" list: the level's operator steps in order, each with
 * the contacts that have its role, then everyone else in the book.
 */

import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { TowerTreatment } from "@/features/symptoms/control-tower/control-tower-api";
import {
  isDriverRole,
  roleKey,
} from "@/features/symptoms/control-tower/contact-roles";
import type { Step } from "@/features/symptoms/maintainer/maintainer-api";
import {
  type CallTarget,
  DRIVER_TARGET_ID,
  targetIdOfAction,
} from "./call-targets";

export interface CallGroup {
  index: number;
  step: Step;
  /** Not yet called first; called in this case after, oldest call first. */
  targets: CallTarget[];
}

export interface CallPlan {
  groups: CallGroup[];
  /** Contacts no step points to. With no steps, every target. */
  others: CallTarget[];
}

/** When each target was last called in the case, by row id. */
export function calledInCase(
  treatments: readonly TowerTreatment[] | undefined
): Map<string, Date> {
  const out = new Map<string, Date>();
  for (const t of treatments ?? []) {
    for (const action of t.actions) {
      const id = targetIdOfAction(action);
      if (!id) continue;
      const at = new Date(action.performedAt);
      const previous = out.get(id);
      if (!previous || previous < at) out.set(id, at);
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

function targetsOfStep(step: Step, targets: readonly CallTarget[]) {
  if (isDriverRole(step.role)) {
    return targets.filter((t) => t.id === DRIVER_TARGET_ID);
  }
  const key = roleKey(step.role);
  if (!key) return [];
  return targets.filter(
    (t) => t.id !== DRIVER_TARGET_ID && roleKey(t.role) === key
  );
}

export function callPlan(
  steps: readonly Step[],
  targets: readonly CallTarget[],
  called: ReadonlyMap<string, Date> = new Map()
): CallPlan {
  const grouped = new Set<string>();
  const groups = steps.map((step, index) => {
    const members = targetsOfStep(step, targets);
    for (const t of members) grouped.add(t.id);
    return { index, step, targets: calledLast(members, called) };
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
