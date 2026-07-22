import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobEventPayload } from "./integration-job.types";
import {
  getJobEventsSnapshot,
  markJobEventsSeen,
  pushJobEventForTests,
  resetJobEventsStoreForTests,
  subscribeJobEvents,
} from "./job-events-store";

function payload(overrides: Partial<JobEventPayload> = {}): JobEventPayload {
  return {
    jobId: "6f9c1c2a-0000-4000-9000-000000000000",
    jobType: "calendar_sync",
    executor: "modulith",
    state: "SUCCEEDED",
    transition: "succeeded",
    attempts: 1,
    maxAttempts: 5,
    correlationKey: "VJ-26-8710",
    chainKey: null,
    chainSequence: 0,
    enqueuedBy: "listener",
    lastError: null,
    nextRetryAt: null,
    updatedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  resetJobEventsStoreForTests();
});

describe("job-events-store", () => {
  it("prepends events, counts notify-worthy transitions as unseen", () => {
    pushJobEventForTests(payload({ transition: "succeeded" }));
    pushJobEventForTests(payload({ transition: "claimed" })); // too chatty — not unseen
    pushJobEventForTests(payload({ transition: "failed" }));

    const snapshot = getJobEventsSnapshot();
    expect(snapshot.events).toHaveLength(3);
    expect(snapshot.events[0].payload.transition).toBe("failed");
    expect(snapshot.unseen).toBe(2);
  });

  it("markJobEventsSeen resets the unseen counter but keeps the feed", () => {
    pushJobEventForTests(payload({ transition: "failed" }));
    markJobEventsSeen();

    const snapshot = getJobEventsSnapshot();
    expect(snapshot.unseen).toBe(0);
    expect(snapshot.events).toHaveLength(1);
  });

  it("caps the feed at 50 entries", () => {
    for (let index = 0; index < 60; index += 1) {
      pushJobEventForTests(payload({ transition: "enqueued" }));
    }
    expect(getJobEventsSnapshot().events).toHaveLength(50);
  });

  it("notifies subscribers on every push and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeJobEvents(listener);

    pushJobEventForTests(payload());
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    pushJobEventForTests(payload());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
