/**
 * Per-origin "task-driven" rollout flag for the calendar planner.
 *
 * Source: `NEXT_PUBLIC_TASK_DRIVEN_ORIGINS` — a comma-separated list of
 * `mintral_originDelegateCode` values that are migrated to the task-driven
 * mode (ECM listeners reconcile the calendar binding; the frontend no longer
 * calls `/mintral/calendar/binding` for these origins).
 *
 * Default is the empty list: every origin is OFF until explicitly enabled.
 * Matching is case-sensitive; whitespace around entries is trimmed and empty
 * entries are ignored.
 *
 * See `docs/plans/calendar-task-driven-frontend-P0-spike.md` §3 for the
 * rationale (mirrors the ECM-side `mintral.calendar.<origin>.defaultId`
 * per-origin gate).
 *
 * No call site reads this flag in P1 — the helper exists so P2/P3 can wire
 * it into the plan/unplan/assign/unassign paths.
 */

function parseOrigins(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set();
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return new Set(entries);
}

export function isOriginTaskDriven(origin: string | undefined): boolean {
  if (!origin) return false;
  const enabled = parseOrigins(process.env.NEXT_PUBLIC_TASK_DRIVEN_ORIGINS);
  return enabled.has(origin);
}
