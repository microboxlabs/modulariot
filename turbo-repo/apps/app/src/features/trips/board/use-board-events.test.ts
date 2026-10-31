import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBoardKey, useBoardEvents } from "./use-board-events";

const mutate = vi.fn();
vi.mock("swr", () => ({ mutate: (...args: unknown[]) => mutate(...args) }));

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  close() {
    this.closed = true;
  }
}

describe("board live updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutate.mockReset();
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reloads the boards once per burst of trip changes and ignores pings", () => {
    const { result, unmount } = renderHook(() => useBoardEvents());
    const source = FakeEventSource.last!;
    expect(source.url).toMatch(/\/api\/trips\/board\/events$/);
    act(() => source.onopen?.());
    expect(result.current).toBe(true);

    act(() => {
      source.onmessage?.({ data: '{"type":"ping"}' });
      vi.advanceTimersByTime(1000);
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      source.onmessage?.({ data: '{"type":"trip","tripId":"a"}' });
      source.onmessage?.({ data: '{"type":"trip","tripId":"b"}' });
      vi.advanceTimersByTime(600);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(isBoardKey);

    unmount();
    expect(source.closed).toBe(true);
  });

  it("refreshes during a continuous stream of changes", () => {
    renderHook(() => useBoardEvents());
    const source = FakeEventSource.last!;
    act(() => {
      for (let i = 0; i < 10; i++) {
        source.onmessage?.({ data: '{"type":"trip","tripId":"a"}' });
        vi.advanceTimersByTime(200);
      }
    });
    expect(mutate).toHaveBeenCalledTimes(3);
  });

  it("matches the board views and trip pages only", () => {
    expect(isBoardKey("/api/trips/board/planning?q=x")).toBe(true);
    expect(isBoardKey("/api/trips/board/sheet/123")).toBe(true);
    expect(isBoardKey("/api/trips/monitors")).toBe(false);
    expect(isBoardKey(["/api/trips/board/planning"])).toBe(false);
  });
});
