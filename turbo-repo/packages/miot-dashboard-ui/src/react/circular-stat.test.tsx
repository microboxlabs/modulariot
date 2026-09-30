// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CircularStat } from "./circular-stat";
afterEach(cleanup);
const labels = {
  title: "Storage",
  valueLabel: "67",
  unit: "GB",
  totalLabel: "de 100 GB",
};
it.each([
  [67, 100, 67],
  [200, 100, 100],
  [-5, 100, 0],
  [1, 0, 0],
  [1, -1, 0],
  [Number.NaN, 100, 0],
  [1, Infinity, 0],
])("bounds accessible progress for %s/%s", (value, max, expected) => {
  const view = render(<CircularStat {...labels} value={value} max={max} />);
  const gauge = screen.getByRole("progressbar", { name: "Storage" });
  expect(gauge.getAttribute("aria-valuenow")).toBe(String(expected));
  expect(gauge.getAttribute("aria-valuetext")).toBe("67 GB; de 100 GB");
  expect(
    Number(
      view.container
        .querySelector(".miot-circular-stat__ring")
        ?.getAttribute("stroke-dashoffset"),
    ),
  ).toBeCloseTo(92 * Math.PI * (1 - expected / 100));
});
it("preserves host formatting as text and rejects non-hex colors", () => {
  const view = render(
    <CircularStat
      {...labels}
      value={67}
      max={100}
      valueLabel="<b>67,0</b>"
      ringColor="url(https://invalid.test)"
    />,
  );
  expect(view.container.querySelector("b")).toBeNull();
  expect(
    view.container
      .querySelector(".miot-circular-stat__ring")
      ?.getAttribute("stroke"),
  ).toBe("#3b82f6");
  view.rerender(
    <CircularStat {...labels} value={10} max={100} ringColor="abc" />,
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "10",
  );
  expect(
    view.container
      .querySelector(".miot-circular-stat__ring")
      ?.getAttribute("stroke"),
  ).toBe("#abc");
});
