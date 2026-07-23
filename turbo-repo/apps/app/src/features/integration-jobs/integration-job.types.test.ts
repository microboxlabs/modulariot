import { describe, expect, it } from "vitest";
import {
  canRetry,
  countdownTo,
  exchangePath,
  exchangeStatusTone,
  readAttemptExchanges,
  formatClock,
  formatDateTime,
  jobContextLine,
  jobDurationMs,
  jobLabel,
  jobTypeLabel,
  readJobOp,
  relativeAge,
  shortJobId,
  sortChain,
  toEpochMs,
  type AsyncJob,
  type AsyncJobAttempt,
} from "./integration-job.types";

const NOW = Date.parse("2026-07-19T12:00:00Z");

function job(overrides: Partial<AsyncJob> = {}): AsyncJob {
  return {
    id: "6f9c1c2a-0000-4000-9000-000000000000",
    tenantCode: "tenant-1",
    sourceInstance: "ecm-prod",
    executor: "modulith",
    jobType: "calendar_sync",
    correlationKey: "VJ-26-8710",
    chainKey: null,
    chainSequence: 0,
    dedupeKey: null,
    payload: {},
    state: "PENDING",
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: null,
    lockedBy: null,
    lockedUntil: null,
    lastError: null,
    attemptHistory: [],
    enqueuedBy: "listener",
    createdAt: new Date(NOW - 60_000).toISOString(),
    updatedAt: new Date(NOW - 30_000).toISOString(),
    ...overrides,
  };
}

describe("integration-job.types", () => {
  it("labels known job types and prettifies unknown ones", () => {
    expect(jobTypeLabel("calendar_sync")).toBe("Calendar sync");
    expect(jobTypeLabel("alerce_arrival")).toBe("Alerce arrival");
    expect(jobTypeLabel("my_custom-type")).toBe("My custom type");
    // ECM mints these; they must not read as ALL-CAPS shouting in the table.
    expect(jobTypeLabel("WHATSAPP_POD_NOTIFY")).toBe("WhatsApp POD notice");
    expect(jobTypeLabel("SOME_NEW_JOB")).toBe("Some new job");
    expect(jobTypeLabel("calendar_confirm")).toBe("Calendar confirm");
    expect(jobTypeLabel("alerce_assignment")).toBe("Alerce assignment");
  });

  it("readJobOp reads a non-blank string op and nothing else", () => {
    expect(readJobOp({ op: "ensure" })).toBe("ensure");
    expect(readJobOp({ op: "  unassign  " })).toBe("unassign");
    expect(readJobOp({ op: "   " })).toBeNull();
    expect(readJobOp({ op: 42 })).toBeNull();
    expect(readJobOp({})).toBeNull();
    expect(readJobOp(undefined)).toBeNull();
  });

  it("labels each calendar_sync op distinctly", () => {
    expect(jobLabel("calendar_sync", "ensure")).toBe("Calendar ensure");
    expect(jobLabel("calendar_sync", "patch")).toBe("Calendar status");
    expect(jobLabel("calendar_sync", "unassign")).toBe("Calendar unassign");
    expect(jobLabel("calendar_sync", "cancel")).toBe("Calendar cancel");
  });

  it("jobLabel falls back to the type label without an op, and shows unknown ops verbatim", () => {
    expect(jobLabel("calendar_sync")).toBe("Calendar sync");
    expect(jobLabel("calendar_sync", null)).toBe("Calendar sync");
    expect(jobLabel("calendar_confirm", null)).toBe("Calendar confirm");
    expect(jobLabel("calendar_sync", "rebook")).toBe("Calendar sync · rebook");
    expect(jobLabel("alerce_arrival", "notify")).toBe("Alerce arrival · notify");
  });

  it("readAttemptExchanges treats the free-form jsonb as untrusted", () => {
    const exchange = { method: "PATCH", url: "http://calendar/r/1", status: 409 };
    expect(readAttemptExchanges({ outcome: "FAILED", http: [exchange] })).toEqual([exchange]);
    expect(readAttemptExchanges({ outcome: "SUCCEEDED" })).toEqual([]);
    // A worker could write anything into attempt_history — none of it may throw.
    expect(readAttemptExchanges({ http: "nope" } as unknown as AsyncJobAttempt)).toEqual([]);
    expect(
      readAttemptExchanges({ http: [null, 7, exchange] } as unknown as AsyncJobAttempt),
    ).toEqual([exchange]);
  });

  it("exchangePath strips the origin and survives a malformed url", () => {
    expect(exchangePath("https://calendar.test/api/v1/miot-calendar/bookings?calendarId=7")).toBe(
      "/api/v1/miot-calendar/bookings?calendarId=7",
    );
    expect(exchangePath("/relative/path")).toBe("/relative/path");
    expect(exchangePath(undefined)).toBe("—");
  });

  it("exchangeStatusTone separates ok, caller error and no-response", () => {
    const ok = exchangeStatusTone(200);
    const clientError = exchangeStatusTone(409);
    const serverError = exchangeStatusTone(500);
    expect(ok).toContain("green");
    expect(clientError).toContain("amber");
    expect(serverError).toContain("rose");
    // A call that never got a response reads as badly as a 5xx.
    expect(exchangeStatusTone(undefined)).toBe(serverError);
  });

  it("shortJobId keeps the first uuid segment", () => {
    expect(shortJobId("6f9c1c2a-0000-4000-9000-000000000000")).toBe("6f9c1c2a");
  });

  it("relativeAge is compact and countdownTo handles past instants", () => {
    expect(relativeAge(new Date(NOW - 2_000).toISOString(), NOW)).toBe("now");
    expect(relativeAge(new Date(NOW - 42_000).toISOString(), NOW)).toBe("42s");
    expect(relativeAge(new Date(NOW - 7 * 60_000).toISOString(), NOW)).toBe("7m");
    expect(countdownTo(new Date(NOW + 12_000).toISOString(), NOW)).toBe("in 12s");
    expect(countdownTo(new Date(NOW - 1_000).toISOString(), NOW)).toBe("due now");
  });

  it("jobContextLine covers running, backoff, chain-blocked and failed", () => {
    expect(jobContextLine(job({ state: "RUNNING", lockedBy: "modulith-01" }), NOW)).toBe(
      "running · modulith-01",
    );
    expect(
      jobContextLine(job({ attempts: 2, nextRetryAt: new Date(NOW + 18_000).toISOString() }), NOW),
    ).toBe("retry 3 of 5 · in 18s");
    expect(jobContextLine(job({ chainKey: "svc:x", chainSequence: 1 }), NOW)).toBe(
      "chain step 1 · waiting",
    );
    expect(jobContextLine(job({ state: "FAILED", lastError: "409 Conflict" }), NOW)).toBe("409 Conflict");
    expect(jobContextLine(job(), NOW)).toBe("queued · listener");
  });

  it("canRetry mirrors the backend babysitter rule", () => {
    expect(canRetry(job({ state: "FAILED" }))).toBe(true);
    expect(canRetry(job({ state: "CANCELLED" }))).toBe(true);
    expect(canRetry(job({ state: "PENDING", nextRetryAt: new Date(NOW + 5_000).toISOString() }))).toBe(true);
    expect(canRetry(job({ state: "PENDING" }))).toBe(false);
    expect(canRetry(job({ state: "RUNNING" }))).toBe(false);
    expect(canRetry(job({ state: "SUCCEEDED" }))).toBe(false);
  });

  it("toEpochMs handles ISO strings, epoch seconds, epoch millis and junk", () => {
    expect(toEpochMs("2026-07-19T12:00:00Z")).toBe(NOW);
    expect(toEpochMs(NOW)).toBe(NOW); // epoch millis pass through
    expect(toEpochMs(NOW / 1000)).toBe(NOW); // epoch seconds are scaled
    expect(toEpochMs(null)).toBeNull();
    expect(toEpochMs("not a date")).toBeNull();
    expect(toEpochMs({})).toBeNull();
  });

  it("formatDateTime and formatClock render local absolute times", () => {
    const iso = "2026-07-19T12:34:56Z";
    const expected = new Date(iso);
    const pad = (part: number) => String(part).padStart(2, "0");
    expect(formatClock(iso)).toBe(
      `${pad(expected.getHours())}:${pad(expected.getMinutes())}:${pad(expected.getSeconds())}`,
    );
    expect(formatDateTime(iso)).toContain(String(expected.getFullYear()));
    expect(formatDateTime(null)).toBe("—");
  });

  it("jobDurationMs derives enqueue→final-report duration and feeds the context line", () => {
    const closed = job({
      state: "SUCCEEDED",
      createdAt: new Date(NOW - 10_000).toISOString(),
      attemptHistory: [{ at: new Date(NOW - 5_900).toISOString(), outcome: "SUCCEEDED" }],
    });
    expect(jobDurationMs(closed)).toBe(4100);
    expect(jobContextLine(closed, NOW)).toBe("completed in 4.1s");
    expect(jobDurationMs(job())).toBeNull();
    expect(jobContextLine(job({ state: "SUCCEEDED" }), NOW)).toBe("completed");
  });

  it("sortChain orders by chainSequence without mutating input", () => {
    const first = job({ id: "a", chainSequence: 1 });
    const second = job({ id: "b", chainSequence: 0 });
    const input = [first, second];
    expect(sortChain(input).map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(input[0].id).toBe("a");
  });
});
