// @vitest-environment jsdom
import { createRef, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ColumnFilterInput,
  type ColumnFilterInputLabels,
} from "./column-filter-input";
import type { ColumnDataType, ColumnFilter } from "../core/column-filter-types";
const labels: ColumnFilterInputLabels = {
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
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function props(dataType: ColumnDataType) {
  return {
    columnKey: "field",
    dataType,
    currentFilter: undefined,
    enumValues: [],
    labels,
    onFilterChange: vi.fn(),
  };
}
it("debounces text, cancels explicit clear/unmount, and isolates a changed column", () => {
  vi.useFakeTimers();
  const options = props("text");
  const cancelDebounceRef = createRef<(() => void) | undefined>();
  const view = render(
    <ColumnFilterInput {...options} cancelDebounceRef={cancelDebounceRef} />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "BQ" } });
  expect(options.onFilterChange).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenLastCalledWith("field", {
    columnKey: "field",
    dataType: "text",
    operator: "contains",
    value: "BQ",
  });
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "cancel" },
  });
  cancelDebounceRef.current?.();
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "old column" },
  });
  view.rerender(<ColumnFilterInput {...options} columnKey="new" />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "unmounted" },
  });
  view.unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenCalledTimes(1);
});
it("edits numeric operators, partial ranges and clears empty values", () => {
  vi.useFakeTimers();
  const options = props("number");
  render(<ColumnFilterInput {...options} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Operator" }), {
    target: { value: "between" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum" }), {
    target: { value: "10" },
  });
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenLastCalledWith(
    "field",
    expect.objectContaining({ value: [10, Infinity] }),
  );
  fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum" }), {
    target: { value: "20" },
  });
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenLastCalledWith(
    "field",
    expect.objectContaining({ value: [10, 20] }),
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "gt" } });
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenLastCalledWith(
    "field",
    expect.objectContaining({ operator: "gt", value: 10 }),
  );
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
  act(() => vi.advanceTimersByTime(300));
  expect(options.onFilterChange).toHaveBeenLastCalledWith("field", null);
});
function Host({ dataType }: { readonly dataType: ColumnDataType }) {
  const [filter, setFilter] = useState<ColumnFilter>();
  return (
    <ColumnFilterInput
      {...props(dataType)}
      currentFilter={filter}
      enumValues={["BQ", "BQ", "<img>"]}
      onFilterChange={(_key, next) => setFilter(next ?? undefined)}
    />
  );
}
it("renders searchable native enum selections as literal text", () => {
  const view = render(<Host dataType="enum" />);
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  fireEvent.click(screen.getByRole("checkbox", { name: "BQ" }));
  expect(
    (screen.getByRole("checkbox", { name: "BQ" }) as HTMLInputElement).checked,
  ).toBe(true);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No matches")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "<img>" } });
  expect(screen.getByRole("checkbox", { name: "<img>" })).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
});
it("isolates boolean radio groups and date labels across dashboard instances", () => {
  const view = render(
    <>
      <Host dataType="boolean" />
      <Host dataType="boolean" />
    </>,
  );
  const yes = screen.getAllByRole("radio", {
    name: "Yes",
  }) as HTMLInputElement[];
  expect(yes[0]!.name).not.toBe(yes[1]!.name);
  fireEvent.click(yes[0]!);
  fireEvent.click(yes[1]!);
  expect(yes.every((input) => input.checked)).toBe(true);
  const options = props("date");
  view.rerender(
    <>
      <ColumnFilterInput {...options} />
      <ColumnFilterInput {...options} />
    </>,
  );
  const from = screen.getAllByLabelText("From");
  expect(from[0]!.id).not.toBe(from[1]!.id);
  fireEvent.change(from[0]!, { target: { value: "2026-09-01" } });
  expect(options.onFilterChange).toHaveBeenLastCalledWith(
    "field",
    expect.objectContaining({ value: ["2026-09-01", ""] }),
  );
});
