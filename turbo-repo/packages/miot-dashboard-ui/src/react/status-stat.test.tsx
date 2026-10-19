// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StatusStat } from "./status-stat";
afterEach(cleanup);
it("renders literal values, optional subtitle and a decorative host icon", () => {
  const view = render(
    <StatusStat
      title="Status <img>"
      value="12"
      subtitle="Online"
      icon={<svg data-testid="icon" />}
      borderColor="ef4444"
      iconColor="22c55e"
      valueColor="3b82f6"
    />,
  );
  expect(screen.getByRole("article").style.borderLeftColor).toBe(
    "rgb(239, 68, 68)",
  );
  expect(screen.getByText("12").style.color).toBe("rgb(59, 130, 246)");
  expect(
    screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(screen.getByText("Online")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
});
it("ignores unsafe colors and omits absent optional content", () => {
  const view = render(
    <StatusStat
      title="Status"
      value="Ready"
      borderColor="red;display:none"
      iconColor="url(test)"
      valueColor="constructor"
    />,
  );
  expect(screen.getByRole("article").style.borderLeftColor).toBe("");
  expect(screen.getByText("Ready").style.color).toBe("");
  expect(view.container.querySelector(".miot-status-stat__icon")).toBeNull();
  expect(
    view.container.querySelector(".miot-status-stat__subtitle"),
  ).toBeNull();
});
