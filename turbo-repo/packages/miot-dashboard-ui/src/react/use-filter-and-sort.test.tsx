// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useFilterAndSort } from "./use-filter-and-sort";
import { resolveDataProperty } from "../core/resolve-data-property";
const filter = {
  enabled: true,
  items: [{ column: "{{row.service}}", label: "Service" }],
};
const sort = { enabled: true, columns: ["cost", "missing"] };
const columns = [{ key: "cost", label: "Cost" }];
const rows = [
  { service: "BQ", cost: "10" },
  { service: "SQL", cost: "2" },
  { service: "BQ", cost: "" },
];
it("filters distinct values and cycles numeric sorting without mutating rows", () => {
  const original = JSON.stringify(rows);
  const { result } = renderHook(() =>
    useFilterAndSort(filter, sort, rows, columns),
  );
  expect(result.current.filterOptionsByColumn["{{row.service}}"]).toEqual([
    "BQ",
    "SQL",
  ]);
  expect(result.current.validSortColumns).toEqual(["cost"]);
  expect(result.current.getColumnLabel("cost")).toBe("Cost");
  act(() => result.current.handleSortClick("cost"));
  expect(result.current.displayRows.map((r) => r.cost)).toEqual([
    "2",
    "10",
    "",
  ]);
  act(() => result.current.handleSortClick("cost"));
  expect(result.current.displayRows.map((r) => r.cost)).toEqual([
    "10",
    "2",
    "",
  ]);
  act(() => result.current.handleSortClick("cost"));
  expect(result.current.displayRows).toBe(rows);
  act(() => result.current.handleFilterSelect("{{row.service}}", "BQ"));
  expect(result.current.displayRows.map((r) => r.cost)).toEqual(["10", ""]);
  act(() => result.current.handleFilterClear("{{row.service}}"));
  expect(result.current.displayRows).toBe(rows);
  expect(JSON.stringify(rows)).toBe(original);
});
it("isolates instances and stops applying removed sort columns", () => {
  const first = renderHook(
    ({ cols }) => useFilterAndSort(filter, sort, rows, cols),
    { initialProps: { cols: columns } },
  );
  const second = renderHook(() =>
    useFilterAndSort(filter, sort, rows, columns),
  );
  act(() => first.result.current.handleSortClick("cost"));
  expect(first.result.current.displayRows[0]?.cost).toBe("2");
  expect(second.result.current.displayRows).toBe(rows);
  first.rerender({ cols: [] });
  expect(first.result.current.displayRows).toBe(rows);
});
it("treats prototype-shaped column names as data without inheriting values", () => {
  const specialRows = [
    JSON.parse('{"__proto__":"one","constructor":"2"}'),
    {},
  ] as Record<string, string>[];
  const specialFilter = {
    enabled: true,
    items: [
      { column: "__proto__", label: "Special" },
      { column: "constructor", label: "Constructor" },
    ],
  };
  const { result } = renderHook(() =>
    useFilterAndSort(
      specialFilter,
      { enabled: true, columns: ["constructor"] },
      specialRows,
      [{ key: "constructor", label: "Constructor" }],
    ),
  );
  expect(Object.getPrototypeOf(result.current.filterOptionsByColumn)).toBe(
    Object.prototype,
  );
  expect(result.current.filterOptionsByColumn.__proto__).toEqual(["one"]);
  expect(result.current.filterOptionsByColumn.constructor).toEqual(["2"]);
  act(() => result.current.handleFilterSelect("__proto__", "one"));
  act(() => result.current.handleSortClick("constructor"));
  expect(result.current.displayRows).toEqual([specialRows[0]]);
});
it.each([
  ["service", "service"],
  ["{{row.service}}", "service"],
  ["{{ service }}", "service"],
  ["{{a}} - {{b}}", null],
  ["{{helper value}}", null],
])("resolves only simple property references %s", (input, expected) => {
  expect(resolveDataProperty(input!)).toBe(expected);
});
