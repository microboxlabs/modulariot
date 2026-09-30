// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ColumnFilterPopover,
  type ColumnFilterPopoverProps,
} from "./column-filter-popover";
const labels = {
  search: "Search",
  equals: "Equals",
  greaterThan: "Greater",
  lessThan: "Less",
  between: "Between",
  min: "Minimum",
  value: "Value",
  max: "Maximum",
  from: "From",
  to: "To",
  empty: "Empty",
  noMatches: "No matches",
  noValues: "No values",
  all: "All",
  yes: "Yes",
  no: "No",
  operator: "Operator",
};
function props(): ColumnFilterPopoverProps {
  return {
    title: "Filter cost",
    clearLabel: "Clear filter",
    columnKey: "cost",
    dataType: "number",
    currentFilter: undefined,
    enumValues: [],
    labels,
    onFilterChange: vi.fn(),
  };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("opens a labeled dialog, focuses the editor, inherits theme and restores focus on Escape", () => {
  render(
    <div data-miot-theme="dark">
      <ColumnFilterPopover {...props()} />
    </div>,
  );
  const trigger = screen.getByRole("button", { name: "Filter cost" });
  fireEvent.click(trigger);
  const panel = screen.getByRole("dialog", { name: "Filter cost" });
  expect(panel.getAttribute("data-miot-theme")).toBe("dark");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
  expect(document.activeElement).toBe(screen.getByRole("combobox"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it("cancels pending input on clear, outside dismissal and unmount", () => {
  vi.useFakeTimers();
  const options = props();
  const view = render(
    <ColumnFilterPopover
      {...options}
      currentFilter={{
        columnKey: "cost",
        dataType: "number",
        operator: "equals",
        value: 5,
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Filter cost" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenCalledExactlyOnceWith("cost", null);
  fireEvent.click(screen.getByRole("button", { name: "Filter cost" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "13" } });
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Filter cost" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "14" } });
  view.unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenCalledTimes(1);
});
it("uses the host portal and closes when keyboard focus leaves without stealing it", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const view = render(
    <>
      <ColumnFilterPopover
        {...props()}
        portalContainer={container}
        theme="light"
      />
      <button type="button">Outside</button>
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Filter cost" }));
  expect(container.contains(screen.getByRole("dialog"))).toBe(true);
  const outside = screen.getByRole("button", { name: "Outside" });
  act(() => outside.focus());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(outside);
  view.unmount();
  container.remove();
});
