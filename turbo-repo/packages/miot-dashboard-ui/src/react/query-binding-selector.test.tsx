// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryBindingSelector } from "./query-binding-selector";
afterEach(cleanup);
const labels = {
  label: "Query",
  placeholder: "Select",
  emptyLabel: "No queries",
  columnsLabel: "Columns",
  unavailableLabel: "Unavailable",
};
it("selects a named result and copies its schema without changing the catalog", () => {
  const change = vi.fn(),
    schema = vi.fn();
  const columns = ["service", "net_cost"];
  const options = [{ id: "costs", variableName: "costs", schema: columns }];
  const view = render(
    <QueryBindingSelector
      {...labels}
      value=""
      options={options}
      onChange={change}
      onSchemaDetected={schema}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "costs" },
  });
  expect(change).toHaveBeenCalledWith("costs");
  expect(schema).toHaveBeenCalledWith(columns);
  expect(schema.mock.calls[0]?.[0]).not.toBe(columns);
  view.rerender(
    <QueryBindingSelector
      {...labels}
      value="costs"
      options={options}
      onChange={change}
    />,
  );
  expect(screen.getByText("net_cost")).toBeTruthy();
});
it("preserves unavailable bindings visibly and isolates labels between instances", () => {
  const change = vi.fn();
  render(
    <>
      <QueryBindingSelector
        {...labels}
        value="removed"
        options={[]}
        onChange={change}
      />
      <QueryBindingSelector
        {...labels}
        value=""
        options={[]}
        onChange={change}
        disabled
      />
    </>,
  );
  const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
  expect(selects[0]?.value).toBe("removed");
  expect(
    screen.getByRole("option", { name: "Unavailable: removed" }),
  ).toBeTruthy();
  expect(selects[0]?.id).not.toBe(selects[1]?.id);
  expect(selects[1]?.disabled).toBe(true);
  expect(change).not.toHaveBeenCalled();
});
