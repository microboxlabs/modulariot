/**
 * The "A quién llamar" list: the level's operator steps in order, each with
 * the book contacts that meet its condition, then everyone else in the book.
 */

import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type {
  ScriptContext,
  TowerAction,
  TowerTreatment,
} from "@/features/symptoms/control-tower/control-tower-api";
import {
  summarizeWho,
  whoOf,
  type WhoSummary,
} from "@/features/symptoms/control-tower/step-who";
import type { Step } from "@/features/symptoms/maintainer/maintainer-api";
import { fillScriptText } from "@/features/symptoms/maintainer/script-fill";
import { SKIP_TO_STEP } from "../prototype-api-guard";
import { type CallTarget, targetIdOfAction } from "./call-targets";

export interface CallGroup {
  index: number;
  step: Step;
  /** The step's condition on the contact (CEL); empty when the step names nobody. */
  who: string;
  /** The condition read as clauses; null when it says more than they can. */
  summary: WhoSummary | null;
  /** Not yet called first; called in this case after, oldest call first. */
  targets: CallTarget[];
}

export interface CallPlan {
  groups: CallGroup[];
  /** Contacts no step points to. With no steps, every target. */
  others: CallTarget[];
}

/**
 * The furthest step (0-based) the case's call script was skipped to, from
 * the NOTE actions its treatments recorded. Only skips made since `since`
 * (the case's SLA start) count: a new level or the end of a hold starts the
 * script over. Null when nothing was skipped.
 */
export function skippedInCase(
  treatments: readonly TowerTreatment[] | undefined,
  since: number | null,
  level?: number
): number | null {
  let furthest: number | null = null;
  for (const t of treatments ?? []) {
    for (const action of t.actions) {
      const step =
        action.kind === "NOTE" ? action.details?.[SKIP_TO_STEP] : null;
      if (typeof step !== "number" || !Number.isInteger(step) || step < 2)
        continue;
      if (!skipMatchesCase(action, since, level)) continue;
      furthest = Math.max(furthest ?? 0, step - 1);
    }
  }
  return furthest;
}

/** A delayed save from an old panel must not advance a new level or resumed hold. */
function skipMatchesCase(
  action: TowerAction,
  since: number | null,
  level?: number
): boolean {
  if (
    level !== undefined &&
    action.details?.level !== undefined &&
    action.details.level !== level
  )
    return false;
  if (since === null) return true;
  const panelSince = action.details?.slaSince;
  if (typeof panelSince === "string" && Date.parse(panelSince) !== since)
    return false;
  return Date.parse(action.performedAt) >= since;
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

/** The steps' conditions, in order, as the server evaluates them. */
export function stepConditions(steps: readonly Step[]): string[] {
  return steps.map((s) => whoOf(s));
}

/** The ids of the trip's drivers: the people of steps whose condition reads the driver's RUT. */
export function driverIds(
  steps: readonly Step[],
  matches: readonly (readonly string[])[]
): Set<string> {
  const out = new Set<string>();
  steps.forEach((s, i) => {
    if (summarizeWho(whoOf(s))?.driver)
      for (const id of matches[i] ?? []) out.add(id);
  });
  return out;
}

/**
 * Groups the targets under the steps. `matches` is the server's answer for
 * each step's condition, in order; a step without one lists nobody.
 */
export function callPlan(
  steps: readonly Step[],
  targets: readonly CallTarget[],
  called: ReadonlyMap<string, Date> = new Map(),
  matches: readonly (readonly string[])[] = []
): CallPlan {
  const grouped = new Set<string>();
  const groups = steps.map((step, index) => {
    const who = whoOf(step);
    const summary = who ? summarizeWho(who) : null;
    if (summary?.role && !summary.driver && !step.who?.trim())
      summary.role = step.role?.trim() || summary.role;
    const ids = new Set(matches[index] ?? []);
    const members = targets.filter((t) => ids.has(t.id));
    for (const t of members) grouped.add(t.id);
    return {
      index,
      step,
      who,
      summary,
      targets: calledLast(members, called),
    };
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

/**
 * The script context of a case the server has none for (a legacy case), from
 * the treatment page's trip info: the fields the older script names read.
 */
export function contextOfTreatment(
  treatment: TreatmentsGeneralResponseItem | null
): ScriptContext {
  const trip = treatment?.trip_info;
  return {
    case: {
      symptom: treatment?.symptom_info?.name,
      level: treatment?.symptom_info?.icu_code,
    },
    vehicle: { plate: trip?.asset_id },
    trip: {
      origin: trip?.origin,
      destination: trip?.destination,
      driver: { name: trip?.driver, phone: trip?.driver_contact },
      carrier: { name: trip?.carrier },
    },
  };
}

/** Fills a step's script with the case's context; unknown variables stay as written. */
export function fillScript(
  script: string,
  context: ScriptContext | undefined
): string {
  return fillScriptText(script, context);
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
