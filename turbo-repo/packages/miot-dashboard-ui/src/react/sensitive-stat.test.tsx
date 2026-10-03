// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SensitiveStat } from "./sensitive-stat";
afterEach(cleanup);
const labels = { showLabel: "Show", hideLabel: "Hide", hint: "Reveal value" };
it("masks the value from rendered DOM until explicit reveal and hides again", () => {
  const view = render(
    <SensitiveStat
      {...labels}
      title="Balance"
      value="$42"
      valueStyle={{ color: "red" }}
    />,
  );
  expect(view.container.textContent).not.toContain("$42");
  const button = screen.getByRole("button", { name: "Show" });
  expect(button.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(button);
  expect(screen.getByText("$42").style.color).toBe("red");
  expect(screen.queryByText("Reveal value")).toBeNull();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  expect(screen.queryByText("$42")).toBeNull();
});
it("resets disclosure across data and identity changes including returning to the original identity", () => {
  const view = render(
    <SensitiveStat {...labels} resetKey="A" title="Balance" value="$42" />,
  );
  fireEvent.click(screen.getByRole("button"));
  view.rerender(
    <SensitiveStat {...labels} resetKey="B" title="Balance" value="$42" />,
  );
  expect(screen.queryByText("$42")).toBeNull();
  view.rerender(
    <SensitiveStat {...labels} resetKey="A" title="Balance" value="$42" />,
  );
  expect(screen.queryByText("$42")).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  view.rerender(
    <SensitiveStat {...labels} resetKey="A" title="Balance" value="$50" />,
  );
  expect(screen.queryByText("$50")).toBeNull();
});
it("supports initially visible values and isolates controls across instances", () => {
  const view = render(
    <>
      <SensitiveStat
        {...labels}
        title="Public"
        value="<img>"
        sensitive={false}
      />
      <SensitiveStat {...labels} title="Private" value="$42" />
    </>,
  );
  expect(screen.getByText("<img>")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]!.getAttribute("aria-controls")).not.toBe(
    buttons[1]!.getAttribute("aria-controls"),
  );
  fireEvent.click(buttons[0]!);
  expect(screen.queryByText("<img>")).toBeNull();
  expect(screen.queryByText("$42")).toBeNull();
});
