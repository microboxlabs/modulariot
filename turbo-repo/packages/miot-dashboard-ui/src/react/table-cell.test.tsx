// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TableCellValue, renderCell } from "./table-cell";
afterEach(cleanup);
it("renders text, deprecated highlight and unknown formats as literal multiline content", () => {
  const view = render(
    <>
      {renderCell("<img src=x>\nsecond\nthird", "highlight")}
      <TableCellValue value="Plain" type="unknown" />
    </>,
  );
  expect(view.container.querySelector("img")).toBeNull();
  expect(view.container.querySelector("strong")?.textContent).toBe(
    "<img src=x>",
  );
  expect(view.container.querySelector("small")?.textContent).toBe(
    "second third",
  );
  expect(screen.getByText("Plain")).toBeTruthy();
});
it("uses valid named or hex badge rules and skips unsafe colors", () => {
  const view = render(
    <TableCellValue
      value="warning"
      type="badge"
      colorMap={[
        { operator: "equals", value: "warning", color: "url(secret)" },
        { operator: "contains", value: "warn", color: "orange" },
      ]}
    />,
  );
  expect(screen.getByText("warning").getAttribute("data-color")).toBe("orange");
  expect(
    screen.getByText("warning").getAttribute("data-custom-color"),
  ).toBeNull();
  view.rerender(
    <TableCellValue
      value="ok"
      type="badge"
      colorMap={[{ operator: "equals", value: "ok", color: "abcdef" }]}
    />,
  );
  expect(screen.getByText("ok").getAttribute("data-custom-color")).toBe("true");
  expect(
    screen.getByText("ok").style.getPropertyValue("--miot-cell-color"),
  ).toBe("#abcdef");
  view.rerender(
    <TableCellValue
      value="plain"
      type="badge"
      colorMap={[{ operator: "equals", value: "plain", color: "constructor" }]}
    />,
  );
  expect(screen.getByText("plain").getAttribute("data-color")).toBeNull();
});
it.each([
  ["-5%", "0"],
  ["80%", "80"],
  ["90%", "90"],
  ["140%", "100"],
  ["missing", "0"],
])("renders finite accessible progress for %s", (value, expected) => {
  render(
    <TableCellValue value={value} type="progress" progressLabel="Completed" />,
  );
  expect(
    screen
      .getByRole("progressbar", { name: "Completed" })
      .getAttribute("value"),
  ).toBe(expected);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(
    value,
  );
});
it.each([
  ["-1", "negative"],
  ["20", "small"],
  ["2000", "positive"],
  ["none", "neutral"],
])("renders signed value %s with the expected tone", (value, tone) => {
  render(<TableCellValue value={value} type="signed" />);
  expect(screen.getByText(value).getAttribute("data-tone")).toBe(tone);
});
it("honors custom text and progress rule colors without injecting style values", () => {
  const colorMap = [
    { operator: "equals" as const, value: "10", color: "ff0000" },
  ];
  const view = render(<TableCellValue value="10" colorMap={colorMap} />);
  expect(screen.getByText("10").style.color).toBe("rgb(255, 0, 0)");
  view.rerender(
    <TableCellValue value="10" type="progress" colorMap={colorMap} />,
  );
  expect(screen.getByText("10").style.color).toBe("rgb(255, 0, 0)");
});

it("applies matched text colors to both multiline children over theme defaults", () => {
  const view = render(
    <TableCellValue
      value={"Critical\nDetails"}
      colorMap={[{ operator: "contains", value: "Critical", color: "red" }]}
    />,
  );
  expect(
    (view.container.querySelector("strong") as HTMLElement).style.color,
  ).toBe("rgb(239, 68, 68)");
  expect(
    (view.container.querySelector("small") as HTMLElement).style.color,
  ).toBe("rgb(239, 68, 68)");
});
