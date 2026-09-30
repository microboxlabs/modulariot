// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SavedQueryEditor } from "./saved-query-editor";
afterEach(cleanup);
const value = {
  id: "costs",
  variableName: "costs",
  connectionId: "billing",
  operationId: "cost-by-service",
  parameters: {},
};
const connections = [
  {
    id: "billing",
    label: "Billing",
    operations: [
      {
        id: "cost-by-service",
        label: "Costs",
        schema: ["service", "net_cost"],
      },
      { id: "daily", label: "Daily", schema: ["day", "cost"] },
    ],
  },
];
const labels = {
  name: "Name",
  connection: "Connection",
  operation: "Operation",
  parameters: "Parameters",
  parametersHint: "Literal values or filter bindings",
  choose: "Choose",
  unavailable: "Unavailable operation",
  invalid: "Invalid query",
  duplicate: "Duplicate name",
  save: "Save",
};
it("defaults to read-only and blocks unknown catalog entries and invalid parameters", () => {
  const save = vi.fn();
  const view = render(
    <SavedQueryEditor
      value={value}
      connections={connections}
      labels={labels}
      onSave={save}
    />,
  );
  expect(screen.getByRole("button").closest("fieldset")?.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button"));
  expect(save).not.toHaveBeenCalled();
  view.rerender(
    <SavedQueryEditor
      value={value}
      connections={[]}
      labels={labels}
      onSave={save}
      editable
    />,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("alert").textContent).toBe(labels.unavailable);
  view.rerender(
    <SavedQueryEditor
      value={value}
      connections={connections}
      labels={labels}
      onSave={save}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("Parameters"), {
    target: { value: '{"limit":{"kind":"sql","value":"select *"}}' },
  });
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("alert").textContent).toBe(labels.invalid);
  expect(save).not.toHaveBeenCalled();
});
it("saves valid filter bindings and clears stale parameters and schema when switching operations", () => {
  const save = vi.fn();
  render(
    <SavedQueryEditor
      value={value}
      connections={connections}
      labels={labels}
      onSave={save}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("Parameters"), {
    target: {
      value: '{"day":{"kind":"filter","key":"date","omitWhenEmpty":true}}',
    },
  });
  fireEvent.click(screen.getByRole("button"));
  expect(save).toHaveBeenLastCalledWith({
    ...value,
    parameters: { day: { kind: "filter", key: "date", omitWhenEmpty: true } },
  });
  fireEvent.change(screen.getByLabelText("Operation"), {
    target: { value: "daily" },
  });
  fireEvent.click(screen.getByRole("button"));
  expect(save).toHaveBeenLastCalledWith({
    ...value,
    operationId: "daily",
    parameters: {},
    schema: ["day", "cost"],
  });
});
