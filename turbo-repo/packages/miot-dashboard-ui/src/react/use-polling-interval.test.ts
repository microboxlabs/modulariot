// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePollingInterval } from "./use-polling-interval";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "does not schedule invalid or disabled interval %s",
  (interval) => {
    vi.useFakeTimers();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const callback = vi.fn();
    renderHook(() => usePollingInterval(callback, interval));
    act(() => vi.advanceTimersByTime(5000));
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  },
);
it("pauses when hidden, resumes immediately and clears timers on removal", () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const first = vi.fn();
  const second = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ callback }) => usePollingInterval(callback, 1000),
    { initialProps: { callback: first } },
  );
  act(() => vi.advanceTimersByTime(1000));
  expect(first).toHaveBeenCalledTimes(1);
  rerender({ callback: second });
  act(() => vi.advanceTimersByTime(1000));
  expect(second).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  act(() => vi.advanceTimersByTime(5000));
  expect(second).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(second).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(second).toHaveBeenCalledTimes(2);
});
