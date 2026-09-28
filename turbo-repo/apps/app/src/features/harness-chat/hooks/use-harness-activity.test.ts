import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@microboxlabs/miot-harness-client";
import { announceRunMarker } from "../harness-active-run";
import {
  ACTIVITY_POLL_MS,
  newlyFinished,
  useHarnessActivity,
} from "./use-harness-activity";

function run(runId: string, status: string, conversationId = "t1"): RunSummary {
  return {
    run_id: runId,
    conversation_id: conversationId,
    tenant_id: "acme",
    user_id: "ana@example.com",
    status,
    started_at: "2026-01-01T00:00:00Z",
    finished_at: status === "running" ? null : "2026-01-01T00:01:00Z",
    model: null,
    skill_id: null,
    last_step: null,
    usage: { calls: 0, input_tokens: 0, output_tokens: 0 },
    delegates: [],
  };
}

describe("newlyFinished", () => {
  it("returns runs that were running and are not any more", () => {
    const prev = [
      run("a", "running"),
      run("b", "running"),
      run("c", "completed"),
    ];
    const next = [
      run("a", "completed"),
      run("b", "running"),
      run("c", "completed"),
    ];
    expect(newlyFinished(prev, next).map((r) => r.run_id)).toEqual(["a"]);
  });

  it("reports nothing on the first load", () => {
    expect(newlyFinished(undefined, [run("a", "completed")])).toEqual([]);
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SWRConfig,
    {
      value: {
        provider: () => new Map(),
        dedupingInterval: 0,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      },
    },
    children
  );
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useHarnessActivity", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let responses: RunSummary[][];

  beforeEach(() => {
    vi.useFakeTimers();
    responses = [];
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => {
      const body = responses.length > 1 ? responses.shift() : responses[0];
      return Promise.resolve(
        new Response(JSON.stringify(body ?? []), { status: 200 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls while a run is running and notifies when it finishes", async () => {
    responses = [
      [run("a", "running")],
      [run("a", "running")],
      [run("a", "completed")],
    ];
    const onFinished = vi.fn();
    const { result } = renderHook(
      () => useHarnessActivity({ panelOpen: false, onFinished }),
      { wrapper }
    );
    await flush();
    expect(result.current.runningCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onFinished).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.runningCount).toBe(0);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0][0].run_id).toBe("a");

    // Nothing running and the panel closed: polling stops.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("polls while the panel is open even with nothing running", async () => {
    responses = [[run("a", "completed")]];
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useHarnessActivity({ panelOpen: open, onFinished: () => {} }),
      { wrapper, initialProps: { open: false } }
    );
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_MS * 2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ open: true });
    await flush();
    const afterOpen = fetchMock.mock.calls.length;
    expect(afterOpen).toBeGreaterThan(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_MS * 2);
    });
    expect(fetchMock.mock.calls.length).toBe(afterOpen + 2);
  });

  it("refreshes at once when a thread announces a run", async () => {
    responses = [[], [run("b", "running", "t2")]];
    const { result } = renderHook(
      () => useHarnessActivity({ panelOpen: false, onFinished: () => {} }),
      { wrapper }
    );
    await flush();
    expect(result.current.runningCount).toBe(0);

    act(() => announceRunMarker("t2", { runId: "b", status: "running" }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.runningCount).toBe(1);
  });
});
