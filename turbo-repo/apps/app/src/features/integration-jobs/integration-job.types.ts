/**
 * Types + pure helpers for the integrations job console.
 *
 * Mirrors the quarkus-srv integrations component: the `AsyncJob` record served
 * by `/api/v1/orgs/{org}/integrations/console/jobs` and the `integrations.job`
 * EventData frames the backend emits to quarkus-sse on every state transition.
 */

export const JOB_STATES = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type JobState = (typeof JOB_STATES)[number];

export interface AsyncJobAttempt {
  readonly at?: string;
  readonly outcome?: string;
  readonly detail?: string;
  readonly by?: string;
  readonly [key: string]: unknown;
}

export interface AsyncJob {
  readonly id: string;
  readonly tenantCode: string;
  readonly sourceInstance: string;
  readonly executor: string;
  readonly jobType: string;
  readonly correlationKey: string | null;
  readonly chainKey: string | null;
  readonly chainSequence: number;
  readonly dedupeKey: string | null;
  readonly payload: Record<string, unknown>;
  readonly state: JobState;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: string | null;
  readonly lockedBy: string | null;
  readonly lockedUntil: string | null;
  readonly lastError: string | null;
  readonly attemptHistory: AsyncJobAttempt[];
  readonly enqueuedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobsOverview {
  readonly counts: Record<JobState, number>;
  readonly tenantId: string;
  readonly eventType: string;
  readonly liveEventsConfigured: boolean;
}

/** Payload of one `integrations.job` EventData frame from quarkus-sse. */
export interface JobEventPayload {
  readonly jobId: string;
  readonly jobType: string;
  readonly executor: string;
  readonly state: JobState;
  readonly transition:
    | "enqueued"
    | "claimed"
    | "succeeded"
    | "retry_scheduled"
    | "failed"
    | "retried";
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly correlationKey: string | null;
  readonly chainKey: string | null;
  readonly chainSequence: number;
  readonly enqueuedBy: string;
  readonly lastError: string | null;
  readonly nextRetryAt: string | null;
  readonly updatedAt: string | null;
}

export interface JobListFilters {
  readonly state?: JobState;
  readonly jobType?: string;
  readonly chainKey?: string;
  readonly limit?: number;
}

/** flowbite-react Badge color per job state. */
export const JOB_STATE_BADGE: Record<JobState, string> = {
  PENDING: "warning",
  RUNNING: "info",
  SUCCEEDED: "success",
  FAILED: "failure",
  CANCELLED: "gray",
};

/** Tailwind text/dot color pairs for the summary tiles + timeline dots. */
export const JOB_STATE_DOT: Record<JobState, string> = {
  PENDING: "bg-amber-500",
  RUNNING: "bg-blue-500",
  SUCCEEDED: "bg-green-500",
  FAILED: "bg-rose-500",
  CANCELLED: "bg-gray-400",
};

/** Human label for a job_type (free-form strings; known ones get a nice label). */
export function jobTypeLabel(jobType: string): string {
  const known: Record<string, string> = {
    calendar_sync: "Calendar sync",
    alerce_arrival: "Alerce arrival",
    whatsapp_send: "WhatsApp message",
  };
  if (known[jobType]) return known[jobType];
  const words = jobType.replaceAll(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function shortJobId(id: string): string {
  return id.slice(0, 8);
}

/** "now", "42s", "7m", "3h", "2d" — compact relative age. */
export function relativeAge(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return "—";
  const seconds = Math.round((nowMs - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(seconds)) return "—";
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** "in 12s" / "in 3m" / "due now" — countdown to a future instant. */
export function countdownTo(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return "—";
  const seconds = Math.round((new Date(iso).getTime() - nowMs) / 1000);
  if (Number.isNaN(seconds)) return "—";
  if (seconds <= 0) return "due now";
  if (seconds < 60) return `in ${seconds}s`;
  return `in ${Math.round(seconds / 60)}m`;
}

/** Duration of the last finished attempt, in ms, when derivable from history. */
export function lastAttemptDurationMs(job: AsyncJob): number | null {
  // History entries are appended per report; a claim stamps no entry, so we
  // approximate with createdAt→updatedAt when the job closed on attempt one.
  const finished = [...job.attemptHistory]
    .reverse()
    .find((entry) => entry.outcome === "SUCCEEDED" || entry.outcome === "FAILED" || entry.outcome === "SKIPPED");
  if (!finished?.at || !job.updatedAt) return null;
  const startedAt = new Date(job.createdAt).getTime();
  const finishedAt = new Date(finished.at).getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt) || finishedAt < startedAt) return null;
  return finishedAt - startedAt;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

/** One line of context for the table's detail column. */
export function jobContextLine(job: AsyncJob, nowMs: number = Date.now()): string {
  switch (job.state) {
    case "RUNNING":
      return job.lockedBy ? `running · ${job.lockedBy}` : "running";
    case "PENDING":
      if (job.nextRetryAt) {
        return `retry ${Math.min(job.attempts + 1, job.maxAttempts)} of ${job.maxAttempts} · ${countdownTo(job.nextRetryAt, nowMs)}`;
      }
      if (job.chainKey && job.chainSequence > 0) {
        return `chain step ${job.chainSequence} · waiting`;
      }
      return `queued · ${job.enqueuedBy}`;
    case "SUCCEEDED":
      return "completed";
    case "FAILED":
      return job.lastError ?? "failed";
    case "CANCELLED":
      return "cancelled";
  }
}

/** Whether the console can offer a manual retry (mirrors the backend rule). */
export function canRetry(job: AsyncJob): boolean {
  return job.state === "FAILED" || job.state === "CANCELLED" || (job.state === "PENDING" && job.nextRetryAt != null);
}

/** Sort chain members for the drawer's chain tab. */
export function sortChain(jobs: AsyncJob[]): AsyncJob[] {
  return [...jobs].sort((a, b) => a.chainSequence - b.chainSequence);
}
