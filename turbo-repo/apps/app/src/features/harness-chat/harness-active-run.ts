/**
 * The harness run a chat thread is waiting on, remembered in this browser so
 * a reload can re-attach to it instead of losing it. The chat relay announces
 * the run with a CUSTOM event when it starts and again when it is over.
 */

export const HARNESS_RUN_EVENT = "harness_run";

export type HarnessRunMarker = {
  runId: string;
  status: "running" | "finished";
  /** When the harness started the run (ISO), sent once its first event is in. */
  startedAt?: string;
};

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/chat/runs`;
const STORAGE_PREFIX = "harness-chat.active-run.";

export function isHarnessRunMarker(value: unknown): value is HarnessRunMarker {
  if (typeof value !== "object" || value === null) return false;
  const { runId, status } = value as Record<string, unknown>;
  return (
    typeof runId === "string" && (status === "running" || status === "finished")
  );
}

export function readActiveRun(threadId: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + threadId);
  } catch {
    return null;
  }
}

export function writeActiveRun(threadId: string, runId: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + threadId, runId);
  } catch {
    // storage unavailable: a reload just won't re-attach
  }
}

/** Clears the marker, but only while it still names `runId` when one is given. */
export function clearActiveRun(threadId: string, runId?: string): void {
  try {
    if (runId && readActiveRun(threadId) !== runId) return;
    window.localStorage.removeItem(STORAGE_PREFIX + threadId);
  } catch {
    // storage unavailable
  }
}

/** Window event fired when any thread's run starts or ends, so the activity
 * panel refreshes without waiting for its next poll. */
export const RUN_MARKER_WINDOW_EVENT = "harness-chat:run-marker";

export function announceRunMarker(
  threadId: string,
  marker: HarnessRunMarker
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(RUN_MARKER_WINDOW_EVENT, {
      detail: { threadId, ...marker },
    })
  );
}

/** `aguiRunId` is the id the browser gave this AG-UI run; the relay echoes it
 * in RUN_STARTED and RUN_FINISHED. */
export function resumeRunUrl(
  runId: string,
  threadId: string,
  aguiRunId: string
): string {
  const query = new URLSearchParams({ threadId, runId: aguiRunId });
  return `${BASE}/${encodeURIComponent(runId)}/stream?${query.toString()}`;
}

/** The harness run's status ("running", "completed", "failed"), "unknown"
 * when the harness does not know it, or null when it could not be asked. */
export async function fetchRunStatus(runId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(runId)}`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) return null;
  if (res.status === 404) return "unknown";
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  return typeof body?.status === "string" ? body.status : null;
}

export async function cancelRun(runId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  }).catch(() => null);
  return res?.ok ?? false;
}
