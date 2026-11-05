import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  pushJobEventForTests,
  resetJobEventsStoreForTests,
} from "./job-events-store";
import type { JobEventPayload } from "./integration-job.types";
import { useJobEvents } from "./use-job-events";

const state = vi.hoisted(() => ({
  overview: { liveEventsConfigured: true } as
    | { liveEventsConfigured: boolean }
    | undefined,
  revalidate: vi.fn(),
}));

class FakeEventSource {
  static readonly CLOSED = 2;
  static current: FakeEventSource;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeEventSource.current = this;
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}
vi.mock("./use-integration-jobs", () => ({
  useIntegrationJobsOverview: () => ({ overview: state.overview }),
  useRevalidateJobs: () => state.revalidate,
}));

function event(jobId: string): JobEventPayload {
  return {
    jobId,
    jobType: "calendar_sync",
    executor: "modulith",
    state: "SUCCEEDED",
    transition: "succeeded",
    attempts: 1,
    maxAttempts: 5,
    correlationKey: null,
    chainKey: null,
    chainSequence: 0,
    enqueuedBy: "listener",
    lastError: null,
    nextRetryAt: null,
    updatedAt: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  state.overview = { liveEventsConfigured: true };
  state.revalidate.mockReset();
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  cleanup();
  resetJobEventsStoreForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("hides the old organization's activity while the new overview is still unavailable", () => {
  const { result, rerender } = renderHook(({ org }) => useJobEvents(org), {
    initialProps: { org: "org-a" as string | null },
  });
  act(() => pushJobEventForTests(event("job-a")));
  expect(result.current.events[0].payload.jobId).toBe("job-a");
  state.overview = undefined;
  rerender({ org: "org-b" });
  expect(result.current).toMatchObject({
    connected: false,
    events: [],
    unseen: 0,
  });
  act(() => vi.advanceTimersByTime(500));
  expect(state.revalidate).not.toHaveBeenCalled();

  state.overview = { liveEventsConfigured: true };
  rerender({ org: "org-b" });
  act(() => pushJobEventForTests(event("job-b")));
  expect(result.current.events.map((e) => e.payload.jobId)).toEqual(["job-b"]);
  rerender({ org: null });
  expect(result.current).toMatchObject({
    connected: false,
    events: [],
    unseen: 0,
  });
});

it("refreshes the ledger after connecting and reconnecting without needing a new event", () => {
  const { result } = renderHook(() => useJobEvents("org-a"));
  act(() => FakeEventSource.current.onopen?.());
  act(() => vi.advanceTimersByTime(400));
  expect(state.revalidate).toHaveBeenCalledTimes(1);
  act(() => FakeEventSource.current.onerror?.());
  act(() => FakeEventSource.current.onopen?.());
  act(() => vi.advanceTimersByTime(400));
  expect(state.revalidate).toHaveBeenCalledTimes(2);
  expect(result.current.events).toEqual([]);
});
