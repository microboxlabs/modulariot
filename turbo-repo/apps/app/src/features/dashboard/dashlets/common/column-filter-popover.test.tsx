// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ColumnFilterPopover } from "./column-filter-popover";
vi.mock("@/features/dashboard/context/dashboard-context", () => ({
  useOptionalDashboard: () => ({ dictionary: {} }),
}));
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
afterEach(cleanup);
it("moves focus into the editor and returns it after Escape", () => {
  render(
    <ColumnFilterPopover
      columnKey="name"
      columnLabel="Name"
      dataType="text"
      currentFilter={undefined}
      enumValues={[]}
      onFilterChange={vi.fn()}
    />
  );
  const trigger = screen.getByRole("button");
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
