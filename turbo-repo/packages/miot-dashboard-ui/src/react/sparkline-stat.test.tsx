// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SparklineStat } from "./sparkline-stat";
afterEach(cleanup);
it("renders formatted literal text with a host-provided trend summary", () => {
  const view = render(
    <SparklineStat
      title="<img>"
      value="1,234"
      unit="USD"
      values={[0, 10, 5]}
      trendLabel="Cost rose then fell"
    />,
  );
  expect(screen.getByText("Cost rose then fell")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("1,234").textContent).toBe("1,234USD");
  expect(view.container.querySelectorAll("path")[1]?.getAttribute("d")).toBe(
    "M 0,50 L 100,0 L 200,25",
  );
});
it("handles empty, single, flat, extreme and missing samples without nonfinite geometry", () => {
  const view = render(<SparklineStat title="Cost" value="42" values={[]} />);
  for (const values of [
    [],
    [1],
    [2, 2],
    [-Number.MAX_VALUE, Number.MAX_VALUE],
    [1, 2, NaN, 3, 4],
    [Infinity, NaN],
  ]) {
    view.rerender(<SparklineStat title="Cost" value="42" values={values} />);
    const paths = Array.from(
      view.container.querySelectorAll("path"),
      (p) => p.getAttribute("d") ?? "",
    );
    expect(paths.join(" ")).not.toMatch(/NaN|Infinity/);
    expect(screen.queryByRole("img")).toBeNull();
    if (values.length === 5) expect(paths[1]?.match(/M /g)).toHaveLength(2);
    if (values.length < 2) expect(paths).toEqual(["", ""]);
  }
});
