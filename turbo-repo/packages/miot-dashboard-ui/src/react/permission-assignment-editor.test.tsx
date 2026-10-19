// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  PermissionAssignmentEditor,
  type PermissionAssignment,
} from "./permission-assignment-editor";
afterEach(cleanup);
const labels = {
  authority: "Identity",
  role: "Role",
  choose: "Choose",
  add: "Add",
  remove: "Remove",
  empty: "No assignments",
  roles: {
    Consumer: "Viewer",
    Contributor: "Contributor",
    Editor: "Editor",
    Coordinator: "Coordinator",
  },
};
const authorities = [
  { id: "alice", label: "Alice" },
  { id: "bob", label: "Bob" },
];
it("preserves undiscoverable assignments and prevents duplicate identities", () => {
  function Host() {
    const [assignments, setAssignments] = useState<PermissionAssignment[]>([
      { authorityId: "unknown", role: "Consumer" },
    ]);
    return (
      <PermissionAssignmentEditor
        assignments={assignments}
        authorities={authorities}
        labels={labels}
        onChange={setAssignments}
        editable
      />
    );
  }
  render(<Host />);
  fireEvent.change(screen.getByLabelText("Identity"), {
    target: { value: "alice" },
  });
  fireEvent.change(screen.getByLabelText("Role"), {
    target: { value: "Editor" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(
    (screen.getByLabelText("Role: Alice") as HTMLSelectElement).value,
  ).toBe("Editor");
  expect(screen.queryByRole("option", { name: "Alice" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Role: Alice"), {
    target: { value: "Consumer" },
  });
  expect(
    (screen.getByLabelText("Role: Alice") as HTMLSelectElement).value,
  ).toBe("Consumer");
  fireEvent.click(screen.getByRole("button", { name: "Remove: Alice" }));
  expect(screen.queryByLabelText("Role: Alice")).toBeNull();
  expect(screen.getByText("unknown")).toBeTruthy();
});
it("fails closed for read-only, busy and revoked access or catalog choices", () => {
  const change = vi.fn();
  const props = {
    assignments: [{ authorityId: "alice", role: "Consumer" as const }],
    authorities,
    labels,
    onChange: change,
  };
  const view = render(<PermissionAssignmentEditor {...props} />);
  expect(screen.queryByRole("button")).toBeNull();
  fireEvent.change(screen.getByLabelText("Role: Alice"), {
    target: { value: "Coordinator" },
  });
  expect(change).not.toHaveBeenCalled();
  view.rerender(<PermissionAssignmentEditor {...props} editable />);
  fireEvent.change(screen.getByLabelText("Identity"), {
    target: { value: "bob" },
  });
  view.rerender(
    <PermissionAssignmentEditor {...props} editable authorities={[]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(change).not.toHaveBeenCalled();
  view.rerender(<PermissionAssignmentEditor {...props} editable disabled />);
  fireEvent.change(screen.getByLabelText("Role: Alice"), {
    target: { value: "Coordinator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove: Alice" }));
  expect(change).not.toHaveBeenCalled();
  view.rerender(<PermissionAssignmentEditor {...props} />);
  expect(screen.queryByLabelText("Identity")).toBeNull();
});
