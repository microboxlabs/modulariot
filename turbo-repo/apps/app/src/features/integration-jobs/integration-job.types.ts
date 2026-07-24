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

/**
 * One HTTP call an attempt made, as recorded by the backend's `JobHttpTrace`
 * and stored under `attempt_history[].http`.
 *
 * `status` is absent when the call never got a response (timeout, DNS, dropped
 * connection) — `error` carries the transport failure instead. Headers are
 * deliberately never recorded: that is where the bearer tokens are.
 */
export interface JobHttpExchange {
  readonly at?: string;
  readonly method?: string;
  readonly url?: string;
  readonly status?: number;
  readonly durationMs?: number;
  readonly requestBody?: string;
  readonly responseBody?: string;
  readonly error?: string;
  /** Overflow marker emitted when the per-attempt cap turned exchanges away. */
  readonly note?: string;
}

export interface AsyncJobAttempt {
  readonly at?: string;
  readonly outcome?: string;
  readonly detail?: string;
  readonly by?: string;
  readonly http?: JobHttpExchange[];
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
  /**
   * The job payload's `op`, lifted onto the frame by `JobEventEmitter` so the
   * bell can label a job as precisely as the console table does (the frame
   * carries no payload). Absent on job types that have no ops — and on frames
   * emitted by a backend older than that change.
   */
  readonly jobOp?: string | null;
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

/**
 * A per-job-type failure-notification rule, as served by
 * `/integrations/console/notification-rules`: when jobs of `jobType` park as
 * FAILED, message `recipients` on `channel` at most once per
 * `throttleSeconds`.
 */
export interface NotificationRule {
  readonly id: string;
  readonly tenantCode: string;
  readonly jobType: string;
  readonly channel: string;
  readonly recipients: string[];
  readonly enabled: boolean;
  readonly throttleSeconds: number;
  readonly templateName: string | null;
  readonly language: string | null;
  readonly lastNotifiedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

/** Upsert body for a rule (jobType rides the path; channel defaults to whatsapp). */
export interface NotificationRuleUpsert {
  readonly recipients: string[];
  readonly enabled: boolean;
  readonly throttleSeconds: number;
}

/** Mirrors the backend's recipient validation (full E.164, e.g. +56912345678). */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

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
    WHATSAPP_POD_NOTIFY: "WhatsApp POD notice",
  };
  if (known[jobType]) return known[jobType];
  // Job types are free-form and the enqueuers do not agree on a case: most are
  // snake_case, a few are SCREAMING_CASE. Lowercase the shouting ones first so
  // an unknown type reads as a sentence rather than as an alarm.
  const cased = /[a-z]/.test(jobType) ? jobType : jobType.toLowerCase();
  const words = cased.replaceAll(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Per-op labels, because a job type is not always one operation.
 *
 * `calendar_sync` is a single type carrying four unrelated writes (see
 * `CalendarSyncFeature.OP_*`), so labelling by type alone renders a whole
 * chain as an indistinguishable stack of "Calendar sync" rows and the operator
 * has to open each one to learn what it did.
 */
const JOB_OP_LABELS: Record<string, Record<string, string>> = {
  calendar_sync: {
    // Upsert: create-if-absent at the slot / re-slot, then set the stage status.
    ensure: "Calendar ensure",
    // Status-only push (plus a resource-data merge) — no slot decision.
    patch: "Calendar status",
    unassign: "Calendar unassign",
    cancel: "Calendar cancel",
  },
};

/** The `op` a job payload carries, when it has one. */
export function readJobOp(
  payload: Record<string, unknown> | null | undefined
): string | null {
  const op = payload?.op;
  if (typeof op !== "string") return null;
  const trimmed = op.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Human label for a job, op included. Falls back to {@link jobTypeLabel} when
 * the job carries no op, and to `"<Type> · <op>"` for an op we have no label
 * for — so a new backend op shows up as itself instead of collapsing into its
 * siblings.
 */
export function jobLabel(jobType: string, op?: string | null): string {
  if (!op) return jobTypeLabel(jobType);
  return JOB_OP_LABELS[jobType]?.[op] ?? `${jobTypeLabel(jobType)} · ${op}`;
}

export function shortJobId(id: string): string {
  return id.slice(0, 8);
}

/**
 * The HTTP exchanges an attempt recorded. `attempt_history` is free-form jsonb
 * written by more than one worker, so this treats the shape as untrusted rather
 * than as its declared type: a non-array, or entries that are not objects, read
 * as "no timeline" instead of crashing the panel.
 */
export function readAttemptExchanges(entry: AsyncJobAttempt): JobHttpExchange[] {
  if (!Array.isArray(entry.http)) return [];
  return entry.http.filter(
    (exchange): exchange is JobHttpExchange =>
      typeof exchange === "object" && exchange !== null
  );
}

/** "POST /api/v1/miot-calendar/bookings" — the URL's path, sans origin. */
export function exchangePath(url: string | undefined): string {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url; // a relative or malformed URL is shown as-is
  }
}

/** Tailwind classes for a status pill: 2xx ok, 4xx caller's fault, else bad. */
export function exchangeStatusTone(status: number | undefined): string {
  if (status === undefined) return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  if (status < 300) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (status < 500) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
}

/**
 * Lenient timestamp → epoch ms. Accepts the ISO-8601 strings the backend
 * emits, plus numeric epochs (seconds or millis) as insurance against
 * serializer changes. Returns null when unparseable.
 */
export function toEpochMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Heuristic: epoch seconds are ~1e9, epoch millis ~1e12.
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** "19-07-2026 18:04:50" — absolute local timestamp for operators. */
export function formatDateTime(value: unknown): string {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  const date = new Date(ms);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** "18:04:50" — local clock time for timeline entries. */
export function formatClock(value: unknown): string {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  const date = new Date(ms);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** "now", "42s", "7m", "3h", "2d" — compact relative age. */
export function relativeAge(value: unknown, nowMs: number = Date.now()): string {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  const seconds = Math.round((nowMs - ms) / 1000);
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** "in 12s" / "in 3m" / "due now" — countdown to a future instant. */
export function countdownTo(value: unknown, nowMs: number = Date.now()): string {
  const ms = toEpochMs(value);
  if (ms == null) return "—";
  const seconds = Math.round((ms - nowMs) / 1000);
  if (seconds <= 0) return "due now";
  if (seconds < 60) return `in ${seconds}s`;
  return `in ${Math.round(seconds / 60)}m`;
}

/**
 * End-to-end duration of a closed job in ms (enqueue → final report), when
 * derivable. Attempt history records report times only (claims stamp no
 * entry), so per-attempt runtimes are not reconstructable — this is the
 * honest total the console can show.
 */
export function jobDurationMs(job: AsyncJob): number | null {
  const finished = [...job.attemptHistory]
    .reverse()
    .find((entry) => entry.outcome === "SUCCEEDED" || entry.outcome === "FAILED" || entry.outcome === "SKIPPED");
  const startedAt = toEpochMs(job.createdAt);
  const finishedAt = toEpochMs(finished?.at);
  if (startedAt == null || finishedAt == null || finishedAt < startedAt) return null;
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
    case "SUCCEEDED": {
      const duration = jobDurationMs(job);
      return duration != null ? `completed in ${formatDurationMs(duration)}` : "completed";
    }
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
