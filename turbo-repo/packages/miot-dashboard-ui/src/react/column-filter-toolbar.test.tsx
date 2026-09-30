// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ColumnFilterToolbar,
  type ColumnFilterToolbarProps,
} from "./column-filter-toolbar";

afterEach(cleanup);
function props(): ColumnFilterToolbarProps {
  return {
    filters: {
      service: {
        columnKey: "service",
        dataType: "text",
        operator: "contains",
        value: "<img>",
      },
    },
    columns: [{ key: "service", label: "Service" }],
    summary: "Showing 1 of 3",
    clearAllLabel: "Clear all",
    removeLabel: (label) => `Remove ${label}`,
    formatValue: (filter) => String(filter.value),
    onRemove: vi.fn(),
    onClearAll: vi.fn(),
  };
}
it("renders literal translated summaries and dispatches removal without submitting forms", () => {
  const options = props();
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const view = render(
    <form onSubmit={submit}>
      <ColumnFilterToolbar {...options} />
    </form>,
  );
  expect(screen.getByRole("status").textContent).toBe(options.summary);
  expect(view.container.querySelector("img")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Service: <img>" }),
  );
  expect(options.onRemove).toHaveBeenCalledWith("service");
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(options.onClearAll).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
});
it("uses fallback column labels, honors disabled state and removes empty summaries", () => {
  const options = props();
  const view = render(
    <ColumnFilterToolbar {...options} columns={[]} disabled />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remove service: <img>" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(options.onRemove).not.toHaveBeenCalled();
  expect(options.onClearAll).not.toHaveBeenCalled();
  view.rerender(<ColumnFilterToolbar {...options} filters={{}} />);
  expect(view.container.textContent).toBe("");
});
