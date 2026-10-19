// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExpandableStat } from "./expandable-stat";
afterEach(cleanup);
const props = {
  title: "Cost",
  value: "42",
  unit: "USD",
  details: [
    { label: "<img>", value: "SQL" },
    { label: "<img>", value: "BQ" },
  ],
  showLabel: "Show",
  hideLabel: "Hide",
};
it("toggles semantic details with unique controls and literal duplicate labels", () => {
  const view = render(
    <>
      <ExpandableStat {...props} />
      <ExpandableStat {...props} />
    </>,
  );
  const buttons = screen.getAllByRole("button", { name: "Show" });
  expect(buttons[0]!.getAttribute("aria-controls")).not.toBe(
    buttons[1]!.getAttribute("aria-controls"),
  );
  expect(screen.queryByText("SQL")).toBeNull();
  fireEvent.click(buttons[0]!);
  expect(buttons[0]!.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getAllByRole("term")).toHaveLength(2);
  expect(screen.getAllByRole("definition")).toHaveLength(2);
  expect(view.container.querySelector("img")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  expect(screen.queryByText("SQL")).toBeNull();
});
it("validates colors and resets expansion on a host identity change", () => {
  const view = render(
    <ExpandableStat
      {...props}
      resetKey="A"
      valueColor="ff0000"
      backgroundColor="00ff00"
    />,
  );
  expect(view.container.querySelector("strong")?.style.color).toBe(
    "rgb(255, 0, 0)",
  );
  expect(
    screen
      .getByRole("article")
      .style.getPropertyValue("--miot-expand-background"),
  ).toBe("#00ff0020");
  fireEvent.click(screen.getByRole("button"));
  view.rerender(
    <ExpandableStat
      {...props}
      resetKey="B"
      valueColor="url(secret)"
      backgroundColor="red"
    />,
  );
  expect(screen.queryByText("SQL")).toBeNull();
  expect(view.container.querySelector("strong")?.style.color).toBe("");
  expect(
    screen
      .getByRole("article")
      .style.getPropertyValue("--miot-expand-background"),
  ).toBe("");
});
