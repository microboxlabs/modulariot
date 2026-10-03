// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StackedStat } from "./stacked-stat";
afterEach(cleanup);
it("renders proportional bars and a literal legend without HTML tooltip injection", () => {
  const view = render(
    <StackedStat
      title="Costs"
      unit="USD"
      items={[
        { label: "<img>", value: 30, color: "ff0000" },
        { label: "Other", value: 70, color: "00ff00" },
      ]}
    />,
  );
  expect(screen.getByRole("img", { name: "Costs" })).toBeTruthy();
  const bars = [...view.container.querySelectorAll("rect")].slice(1);
  expect(bars.map((bar) => bar.getAttribute("width"))).toEqual(["30", "70"]);
  expect(bars.map((bar) => bar.getAttribute("x"))).toEqual(["0", "30"]);
  expect(bars[0]?.querySelector("title")?.textContent).toBe(
    "<img>: 30USD (30.0%)",
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(view.container.querySelector("img")).toBeNull();
});
it("renders donut arcs with finite shares even when the raw total overflows", () => {
  const view = render(
    <StackedStat
      title="Large"
      chartType="donut"
      showHeader={false}
      items={[
        { label: "A", value: 1e308, color: "ff0000" },
        { label: "B", value: 1e308, color: "00ff00" },
      ]}
    />,
  );
  const arcs = [...view.container.querySelectorAll("circle")].slice(1);
  expect(arcs.map((arc) => arc.getAttribute("stroke-dasharray"))).toEqual([
    "50 50",
    "50 50",
  ]);
  expect(arcs.map((arc) => arc.getAttribute("stroke-dashoffset"))).toEqual([
    "0",
    "-50",
  ]);
  expect(view.container.querySelector(".miot-stacked-stat__title")).toBeNull();
});
it("ignores negative/nonfinite areas and falls back for invalid colors", () => {
  const view = render(
    <StackedStat
      title="Empty"
      items={[
        { label: "Debt", value: -1, color: "url(secret)" },
        { label: "Missing", value: Infinity, color: "red" },
      ]}
    />,
  );
  expect(view.container.querySelectorAll("rect")).toHaveLength(1);
  expect(
    view.container.querySelector("li span")?.getAttribute("style"),
  ).toContain("rgb(156, 163, 175)");
  expect(view.container.textContent).not.toContain("Infinity");
});
