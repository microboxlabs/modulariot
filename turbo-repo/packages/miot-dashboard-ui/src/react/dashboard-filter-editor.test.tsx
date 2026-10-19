// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DashboardFilterEditor } from "./dashboard-filter-editor";
import { filterDefinitionsSchema } from "./filter-definitions-value";
import { useDashboardState } from "./use-dashboard-state";
import { makeDashboardStorage } from "./test-fixtures";
afterEach(cleanup);
const labels = {
  key: "Key",
  label: "Label",
  type: "Type",
  unique: "Clear other keys in this filter",
  add: "Add filter",
  remove: "Remove filter",
  optionLabel: "Option label",
  optionValue: "Option value",
  addOption: "Add option",
  removeOption: "Remove option",
  apply: "Apply",
  invalid: "Invalid",
  rejected: "Rejected",
  empty: "No filters",
  types: { text: "Text", date_range: "Date range", select: "Select" },
};
it("authors select options and denies apply after access is revoked", () => {
  const onApply = vi.fn(() => false);
  const view = render(
    <DashboardFilterEditor
      value={[]}
      labels={labels}
      onApply={onApply}
      editable
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
  fireEvent.change(screen.getByLabelText("Key"), {
    target: { value: "service" },
  });
  fireEvent.change(screen.getByLabelText("Label"), {
    target: { value: "Service" },
  });
  fireEvent.change(screen.getByLabelText("Type"), {
    target: { value: "select" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add option" }));
  fireEvent.change(screen.getByLabelText("Option label"), {
    target: { value: "Storage" },
  });
  fireEvent.change(screen.getByLabelText("Option value"), {
    target: { value: "storage" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledWith([
    {
      key: "service",
      label: "Service",
      type: "select",
      options: [{ label: "Storage", value: "storage" }],
    },
  ]);
  expect(screen.getByRole("alert").textContent).toBe("Rejected");
  view.rerender(
    <DashboardFilterEditor value={[]} labels={labels} onApply={onApply} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledTimes(1);
});
it("rejects ambiguous effective keys, unsafe keys and repeated option values", () => {
  const date = { key: "period", label: "Period", type: "date_range" };
  const text = { key: "period_from", label: "From", type: "text" };
  for (const filters of [
    [date, text],
    [text, date],
    [text, text],
    [{ ...text, key: "__proto__" }],
    [
      {
        ...text,
        type: "select",
        options: [
          { label: "A", value: "same" },
          { label: "B", value: "same" },
        ],
      },
    ],
  ])
    expect(filterDefinitionsSchema.safeParse(filters).success).toBe(false);
});
it("preserves document fields and supports undo while rejecting invalid and denied changes", () => {
  const initial = makeDashboardStorage({ name: "Billing", filters: [] });
  const view = renderHook(
    ({ readOnly }) => {
      const [config, onChange] = useState(initial);
      return {
        config,
        state: useDashboardState({
          config,
          onChange,
          isLoaded: true,
          readOnly,
        }),
      };
    },
    { initialProps: { readOnly: false } },
  );
  const filters = [
    { key: "period", label: "Period", type: "date_range" as const },
  ];
  act(() => {
    expect(view.result.current.state.setFilterDefinitions(filters)).toBe(true);
  });
  expect(view.result.current.config).toEqual({ ...initial, filters });
  act(() => view.result.current.state.undo());
  expect(view.result.current.config).toEqual(initial);
  act(() => {
    expect(
      view.result.current.state.setFilterDefinitions([...filters, ...filters]),
    ).toBe(false);
  });
  view.rerender({ readOnly: true });
  act(() => {
    expect(view.result.current.state.setFilterDefinitions(filters)).toBe(false);
  });
  expect(view.result.current.config).toEqual(initial);
});

it("authors a named query source and refuses stale discovery before applying", () => {
  const sources = {
    queries: [{ id: "costs", variableName: "billing", schema: ["service"] }],
    labels: {
      source: "Source",
      static: "Static options",
      columns: "Columns",
      unavailable: "Unavailable source",
      valueField: "Value column",
      labelField: "Label column",
      single: "Single selection",
    },
  };
  const onApply = vi.fn(() => true);
  const value = [
    {
      key: "service",
      label: "Service",
      type: "select" as const,
      options: [{ label: "Old", value: "old" }],
    },
  ];
  const view = render(
    <DashboardFilterEditor
      value={value}
      labels={labels}
      sources={sources}
      onApply={onApply}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("Source"), {
    target: { value: "billing" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Value column"), {
    target: { value: "service" },
  });
  fireEvent.click(screen.getByLabelText("Single selection"));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledWith([
    expect.objectContaining({
      single: true,
      optionsSource: { variableName: "billing", valueField: "service" },
    }),
  ]);
  expect(screen.queryByLabelText("Option value")).toBeNull();
  view.rerender(
    <DashboardFilterEditor
      value={value}
      labels={labels}
      sources={{ ...sources, queries: [] }}
      onApply={onApply}
      editable
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable source");
});
