import type { RunActivity } from "./run-activity-types";

const cache = new Map<string, Promise<RunActivity>>();

/** A run's activity, fetched once per page. A failed fetch is not kept, so
 * opening the timeline again retries it. */
export function loadRunActivity(runId: string): Promise<RunActivity> {
  let pending = cache.get(runId);
  if (!pending) {
    pending = fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/chat/runs/${encodeURIComponent(runId)}`
    ).then(async (res) => {
      if (!res.ok) throw new Error(`activity ${res.status}`);
      return (await res.json()) as RunActivity;
    });
    pending.catch(() => cache.delete(runId));
    cache.set(runId, pending);
  }
  return pending;
}

/** Duration as the timeline shows it: "850 ms", "4.2 s", "2 min 5 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60)
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} s`;
}

/** The SQL a step ran, when its arguments carry one. */
export function sqlOf(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const value = (args as Record<string, unknown>).sql;
  return typeof value === "string" && value.trim() ? value : null;
}
