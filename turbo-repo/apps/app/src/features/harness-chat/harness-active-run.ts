/**
 * The harness run a chat thread is waiting on, remembered in this browser so
 * a reload can re-attach to it instead of losing it. The chat relay announces
 * the run with a CUSTOM event when it starts and again when it is over.
 */

export const HARNESS_RUN_EVENT = "harness_run";

export type HarnessRunMarker = {
  runId: string;
  status: "running" | "finished";
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

export async function cancelRun(runId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  }).catch(() => null);
  return res?.ok ?? false;
}
