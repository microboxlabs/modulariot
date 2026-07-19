import { describe, expect, it } from "vitest";
import {
  canRetry,
  countdownTo,
  jobContextLine,
  jobTypeLabel,
  relativeAge,
  shortJobId,
  sortChain,
  type AsyncJob,
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

  it("sortChain orders by chainSequence without mutating input", () => {
    const first = job({ id: "a", chainSequence: 1 });
    const second = job({ id: "b", chainSequence: 0 });
    const input = [first, second];
    expect(sortChain(input).map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(input[0].id).toBe("a");
  });
});
