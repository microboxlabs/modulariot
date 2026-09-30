// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PercentageValue } from "./percentage-value";
afterEach(cleanup);
it.each([
  [6, 10, 60], [20, 10, 100], [-1, 10, 0], [4, 0, 0],
  [4, -1, 0], [Number.NaN, 10, 0], [6, Number.POSITIVE_INFINITY, 60],
  [Number.MAX_VALUE, Number.MIN_VALUE, 100],
])("bounds accessible progress for %s / %s", (value, max, percentage) => {
  render(<PercentageValue title="Costs" value={value} max={max} />);
  const progress = screen.getByRole("progressbar", { name: "Costs" }) as HTMLProgressElement;
  expect(progress.value).toBe(percentage);
  expect(progress.max).toBe(100);
  expect(screen.getByText(`(${percentage}%)`)).toBeTruthy();
});
it("updates resolved values and colors without interpreting text as HTML", () => {
  const view = render(<PercentageValue title="<img src=x>" value={6} max={10} barColor="abc" />);
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByRole("progressbar", { name: "<img src=x>" })).toBeTruthy();
  expect((view.container.firstElementChild as HTMLElement).style.getPropertyValue("--miot-progress-color")).toBe("#abc");
  view.rerender(<PercentageValue title="Budget" value={7} max={10} barColor="url(https://example.invalid)" />);
  expect(screen.getByText("(70%)")).toBeTruthy();
  expect((view.container.firstElementChild as HTMLElement).style.getPropertyValue("--miot-progress-color")).toBe("#2563eb");
});
