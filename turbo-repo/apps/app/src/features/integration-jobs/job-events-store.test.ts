import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobEventPayload } from "./integration-job.types";
import {
  getJobEventsSnapshot,
  markJobEventsSeen,
  pushJobEventForTests,
  resetJobEventsStoreForTests,
  subscribeJobEvents,
  connectJobEvents,
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

class FakeEventSource {
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((message: MessageEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}

function mockStreams() {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
}

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

  it("retries a closed stream once after a delay and preserves its activity", () => {
    mockStreams();
    connectJobEvents("/org-a/events");
    const first = FakeEventSource.instances[0];
    first.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ payload: payload() }),
      })
    );
    first.readyState = FakeEventSource.CLOSED;
    first.onerror?.();
    first.onerror?.();
    connectJobEvents("/org-a/events");
    vi.advanceTimersByTime(4999);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toBe("/org-a/events");
    expect(getJobEventsSnapshot().events).toHaveLength(1);
    expect(getJobEventsSnapshot().connected).toBe(false);
    FakeEventSource.instances[1].onopen?.();
    expect(getJobEventsSnapshot().connected).toBe(true);
  });

  it("keeps native reconnects and shares the same organization's connection", () => {
    mockStreams();
    connectJobEvents("/org-a/events");
    const first = FakeEventSource.instances[0];
    first.onerror?.(); // CONNECTING: the browser owns this retry.
    connectJobEvents("/org-a/events");
    vi.advanceTimersByTime(10000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("clears old activity and retries when switching organizations, ignoring late callbacks", () => {
    mockStreams();
    connectJobEvents("/org-a/events");
    const first = FakeEventSource.instances[0];
    first.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ payload: payload() }),
      })
    );
    first.readyState = FakeEventSource.CLOSED;
    first.onerror?.();
    connectJobEvents("/org-b/events");
    expect(getJobEventsSnapshot()).toMatchObject({
      connected: false,
      events: [],
      unseen: 0,
    });
    first.onopen?.();
    first.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ payload: payload() }),
      })
    );
    first.onerror?.();
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toBe("/org-b/events");
    expect(getJobEventsSnapshot()).toMatchObject({
      connected: false,
      events: [],
      unseen: 0,
    });
  });
});
