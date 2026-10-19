// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FilterPillRow, SortPillRow } from "./row-controls";
import { useFilterAndSort } from "./use-filter-and-sort";
afterEach(cleanup);
function Host() {
  const item = { column: "service", label: "Service" };
  const controls = useFilterAndSort(
    { enabled: true, items: [item] },
    { enabled: true, columns: ["cost"] },
    [
      { service: "SQL", cost: "10" },
      { service: "BQ", cost: "2" },
    ],
    [{ key: "cost", label: "Cost" }],
  );
  return (
    <>
      <FilterPillRow
        item={item}
        options={controls.filterOptionsByColumn.service ?? []}
        selected={controls.filterValues.service ?? ""}
        allLabel="All"
        onSelect={controls.handleFilterSelect}
        onClear={controls.handleFilterClear}
      />
      <SortPillRow
        label="Sort"
        columns={controls.validSortColumns}
        sortKey={controls.sortKey}
        sortDir={controls.sortDir}
        directionLabels={{ asc: "Ascending", desc: "Descending" }}
        getColumnLabel={controls.getColumnLabel}
        onSortClick={controls.handleSortClick}
      />
      <output>
        {controls.displayRows.map((row) => row.service).join(",")}
      </output>
    </>
  );
}
it("filters and cycles sort through the shared controls with accessible state", () => {
  render(<Host />);
  fireEvent.click(screen.getByRole("button", { name: "Cost" }));
  expect(
    screen
      .getByRole("button", { name: "Cost: Ascending" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByRole("status").textContent).toBe("BQ,SQL");
  fireEvent.click(screen.getByRole("button", { name: "Cost: Ascending" }));
  expect(screen.getByRole("button", { name: "Cost: Descending" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("SQL,BQ");
  fireEvent.click(screen.getByRole("button", { name: "BQ" }));
  expect(screen.getByRole("status").textContent).toBe("BQ");
  expect(
    screen.getByRole("button", { name: "BQ" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(screen.getByRole("status").textContent).toBe("SQL,BQ");
});
it("keeps multiple group labels unique and deduplicates literal options", () => {
  const props = {
    item: { column: "x", label: "Choose" },
    options: ["<img>", "<img>", ""],
    selected: "",
    allLabel: "All",
    onClear: vi.fn(),
    onSelect: vi.fn(),
  };
  const view = render(
    <>
      <FilterPillRow {...props} />
      <FilterPillRow {...props} disabled />
    </>,
  );
  const ids = screen
    .getAllByRole("group", { name: "Choose" })
    .map((e) => e.getAttribute("aria-labelledby"));
  expect(new Set(ids).size).toBe(2);
  expect(screen.getAllByRole("button", { name: "<img>" })).toHaveLength(2);
  expect(view.container.querySelector("img")).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "<img>" })[1]!);
  expect(props.onSelect).not.toHaveBeenCalled();
});
it("omits an empty sort group and prevents disabled sort changes", () => {
  const onSortClick = vi.fn();
  const props = {
    label: "Sort",
    columns: [] as string[],
    sortKey: null,
    sortDir: "asc" as const,
    directionLabels: { asc: "Asc", desc: "Desc" },
    getColumnLabel: (key: string) => key,
    onSortClick,
  };
  const view = render(<SortPillRow {...props} />);
  expect(screen.queryByRole("group")).toBeNull();
  view.rerender(<SortPillRow {...props} columns={["cost", "cost"]} disabled />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button"));
  expect(onSortClick).not.toHaveBeenCalled();
});
