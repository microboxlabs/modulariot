// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChartCard } from "./chart-card";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders literal titles, host controls and charts; observes unscaled layout and cleans up", () => {
  let resized = () => {};
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 200,
    height: 150,
  } as DOMRect);
  const onResize = vi.fn();
  const click = vi.fn();
  const view = render(
    <ChartCard
      title="<img> costs"
      onResize={onResize}
      toolbar={<button onClick={click}>30 days</button>}
    >
      <svg aria-label="Cost plot" role="img" />
    </ChartCard>,
  );
  expect(screen.getByRole("heading").textContent).toBe("<img> costs");
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByRole("img", { name: "Cost plot" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button"));
  expect(click).toHaveBeenCalledOnce();
  expect(onResize).toHaveBeenLastCalledWith(400, 300);
  expect(observe).toHaveBeenCalledWith(screen.getByRole("article"));
  act(() => resized());
  expect(onResize).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  act(() => resized());
  expect(onResize).toHaveBeenCalledTimes(2);
});

it("falls back to window resize and replaces callbacks without leaving listeners", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  const first = vi.fn();
  const second = vi.fn();
  const view = render(<ChartCard onResize={first}>Chart</ChartCard>);
  fireEvent(window, new Event("resize"));
  expect(first).toHaveBeenCalledTimes(2);
  view.rerender(<ChartCard onResize={second}>Chart</ChartCard>);
  fireEvent(window, new Event("resize"));
  expect(first).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(2);
  view.unmount();
  fireEvent(window, new Event("resize"));
  expect(second).toHaveBeenCalledTimes(2);
});
