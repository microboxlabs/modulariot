// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SavedQueryManager } from "./saved-query-manager";
afterEach(cleanup);
const labels = {
  name: "Name",
  connection: "Connection",
  operation: "Operation",
  parameters: "Parameters",
  parametersHint: "Bindings",
  choose: "Choose",
  unavailable: "Unavailable",
  invalid: "Invalid",
  duplicate: "Duplicate",
  save: "Save",
  add: "Add query",
  close: "Close",
  remove: "Remove",
  confirmRemove: "Confirm removal",
  cancel: "Cancel",
  empty: "No queries",
  rejected: "Rejected",
};
const query = {
  id: "q1",
  variableName: "costs",
  connectionId: "billing",
  operationId: "costs",
  parameters: {},
};
const connections = [
  {
    id: "billing",
    label: "Billing",
    operations: [{ id: "costs", label: "Costs" }],
  },
];
it("requires confirmation before removal and preserves the list on host rejection", () => {
  const change = vi.fn(() => false);
  render(
    <SavedQueryManager
      queries={[query]}
      connections={connections}
      onChange={change}
      editable
      labels={labels}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove: costs" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remove: costs" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(change).toHaveBeenCalledWith([]);
  expect(screen.getByRole("alert").textContent).toBe("Rejected");
  expect(
    screen.getByRole("button", { name: "costs" }),
  ).toBeTruthy();
});
it("adds an approved definition and immediately removes write controls when permission is revoked", () => {
  function Host({ editable }: { editable: boolean }) {
    const [queries, setQueries] = useState([query]);
    return (
      <SavedQueryManager
        queries={queries}
        connections={connections}
        onChange={(next) => {
          setQueries([...next]);
          return true;
        }}
        labels={labels}
        editable={editable}
        createId={() => "q2"}
      />
    );
  }
  const view = render(<Host editable />);
  fireEvent.click(screen.getByRole("button", { name: "Add query" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "second" },
  });
  fireEvent.change(screen.getByLabelText("Connection"), {
    target: { value: "billing" },
  });
  fireEvent.change(screen.getByLabelText("Operation"), {
    target: { value: "costs" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    screen.getByRole("button", { name: "second" }),
  ).toBeTruthy();
  view.rerender(<Host editable={false} />);
  expect(screen.queryByRole("button", { name: "Add query" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remove: second" })).toBeNull();
});
