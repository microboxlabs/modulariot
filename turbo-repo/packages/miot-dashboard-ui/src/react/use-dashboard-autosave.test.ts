// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  useDashboardAutosave,
  type DashboardAutosaveOptions,
} from "./use-dashboard-autosave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function mount(initial: Partial<DashboardAutosaveOptions>) {
  const save = vi.fn().mockResolvedValue(true);
  const props: DashboardAutosaveOptions = {
    config: { name: "a" },
    dirty: true,
    busy: false,
    error: null,
    save,
    enabled: true,
    ...initial,
  };
  const view = renderHook((p: DashboardAutosaveOptions) => useDashboardAutosave(p), {
    initialProps: props,
  });
  return { save, props, ...view };
}

it("saves once edits pause, restarting the delay on each edit", () => {
  const { save, props, rerender } = mount({});
  vi.advanceTimersByTime(1000);
  rerender({ ...props, config: { name: "ab" } });
  vi.advanceTimersByTime(1000);
  expect(save).not.toHaveBeenCalled();
  vi.advanceTimersByTime(500);
  expect(save).toHaveBeenCalledOnce();
});

it.each([
  ["clean", { dirty: false }],
  ["saving", { busy: true }],
  ["after a failed save", { error: 409 }],
  ["disabled", { enabled: false }],
])("does not save while %s", (_, state) => {
  const { save } = mount(state);
  vi.advanceTimersByTime(5000);
  expect(save).not.toHaveBeenCalled();
});

it("cancels a pending save on unmount", () => {
  const { save, unmount } = mount({});
  unmount();
  vi.advanceTimersByTime(5000);
  expect(save).not.toHaveBeenCalled();
});
