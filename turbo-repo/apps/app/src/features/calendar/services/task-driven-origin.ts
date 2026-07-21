/**
 * Per-origin "task-driven" rollout flag for the calendar planner.
 *
 * Source of truth at runtime is the backend's `RuntimeConfigProvider` —
 * the server reads `TASK_DRIVEN_ORIGINS` from the deployed env and exposes
 * it via `/app/api/runtime-config`. The React layer reads the parsed set
 * via `useTaskDrivenOrigins` and passes it explicitly to each decide-*
 * helper, keeping these helpers pure (testable without React or process.env).
 *
 * Default is the empty set: every origin is OFF until explicitly enabled.
 * Matching is case-sensitive against `service.origen`; whitespace around
 * entries is trimmed and empty entries are ignored.
 *
 * See `docs/plans/calendar-task-driven-frontend-P0-spike.md` §3 for the
 * rationale (mirrors the ECM-side `mintral.calendar.<origin>.defaultId`
 * per-origin gate).
 */

export function parseTaskDrivenOrigins(
  raw: string | undefined | null
): ReadonlySet<string> {
  if (!raw) return new Set();
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return new Set(entries);
}

export function isOriginTaskDriven(
  origin: string | undefined,
  enabledOrigins: ReadonlySet<string>
): boolean {
  if (!origin) return false;
  return enabledOrigins.has(origin);
}

/**
 * Resolve the service's origin delegate code from a booking's
 * `resource.data` blob. `origen` is the canonical key the planner persists
 * (`SelectedService.origen`, populated from `mintral_originDelegateCode`);
 * the longer key is checked as a defensive fallback for bookings written
 * through paths that store the raw Alfresco field name. Returns undefined
 * when the field is missing or not a non-empty string.
 */
export function readBookingOrigin(
  data: Record<string, unknown> | undefined
): string | undefined {
  if (!data) return undefined;
  const candidates = [data.origen, data.mintral_originDelegateCode];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
