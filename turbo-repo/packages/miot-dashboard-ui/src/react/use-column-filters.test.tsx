// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useColumnFilters } from "./use-column-filters";
import { matchesFilter } from "../core/column-filter-engine";
import {
  getDefaultOperator,
  type ColumnDataType,
  type ColumnFilter,
} from "../core/column-filter-types";
const rows = [
  { service: "SQL", cost: "$1,234.56", active: "sí", date: "2026-09-01" },
  { service: "BQ", cost: "1,5", active: "false", date: "2026-09-20" },
];
it("combines filters, clears selections and ignores removed columns", () => {
  const columns = [
    { key: "cost", dataType: "number" as const },
    { key: "service", dataType: "text" as const },
  ];
  const { result, rerender } = renderHook(
    ({ cols }) => useColumnFilters(rows, cols),
    { initialProps: { cols: columns } },
  );
  act(() =>
    result.current.setFilter("cost", {
      columnKey: "wrong",
      dataType: "number",
      operator: "gt",
      value: 100,
    }),
  );
  expect(result.current.filteredData).toEqual([rows[0]]);
  expect(result.current.filters.cost?.columnKey).toBe("cost");
  act(() =>
    result.current.setFilter("service", {
      columnKey: "service",
      dataType: "text",
      operator: "contains",
      value: "bq",
    }),
  );
  expect(result.current.filteredCount).toBe(0);
  act(() => result.current.removeFilter("service"));
  expect(result.current.filteredCount).toBe(1);
  rerender({ cols: [] });
  expect(result.current.filteredData).toBe(rows);
  expect(result.current.activeFilterCount).toBe(0);
  act(() => result.current.clearAllFilters());
  expect(result.current.filters).toEqual({});
});
it("detects types and enumerates values without inheriting prototype properties", () => {
  const data = [...Array(6)].map((_, i) => ({
    cost: String(100 + i),
    date: "2026-09-20",
    active: i % 2 ? "true" : "false",
    service: i % 2 ? "SQL" : "BQ",
    id: "ID" + i,
  }));
  const { result } = renderHook(() =>
    useColumnFilters(
      data,
      ["cost", "date", "active", "service", "id", "constructor"].map((key) => ({
        key,
      })),
    ),
  );
  expect({ ...result.current.resolvedDataTypes }).toEqual({
    cost: "number",
    date: "date",
    active: "boolean",
    service: "enum",
    id: "text",
    constructor: "text",
  });
  expect(result.current.enumValues.service).toEqual(["BQ", "SQL"]);
  expect(result.current.enumValues.constructor).toEqual([]);
  expect(result.current.filters.constructor).toBeUndefined();
  expect(result.current.filters.toString).toBeUndefined();
});
it("supports prototype-shaped keys without prototype mutation", () => {
  const data = [JSON.parse('{"__proto__":"yes"}'), {}] as Record<
    string,
    string
  >[];
  const { result } = renderHook(() =>
    useColumnFilters(data, [{ key: "__proto__", dataType: "text" }]),
  );
  act(() =>
    result.current.setFilter("__proto__", {
      columnKey: "__proto__",
      dataType: "text",
      operator: "equals",
      value: "yes",
    }),
  );
  expect(Object.getPrototypeOf(result.current.filters)).toBeNull();
  expect(result.current.filteredData).toEqual([data[0]]);
});
const cases: [
  ColumnDataType,
  ColumnFilter["operator"],
  ColumnFilter["value"],
  string,
  boolean,
][] = [
  ["text", "contains", "abc", "ABCdef", true],
  ["text", "equals", "abc", "abcdef", false],
  ["number", "equals", 47400, "47,400 km", true],
  ["number", "lt", 2, "1,5", true],
  ["number", "gt", 1000, "$1,234.56", true],
  ["number", "between", [1, 3], "2", true],
  ["number", "equals", 2, "bad", false],
  ["date", "dateRange", ["2026-09-01", "2026-09-30"], "2026-09-20", true],
  ["date", "dateRange", ["2026-10-01", ""], "2026-09-20", false],
  ["date", "dateRange", ["", "2026-09-30"], "bad", false],
  ["enum", "in", ["BQ"], "BQ", true],
  ["enum", "in", [], "any", true],
  ["enum", "in", ["SQL"], "BQ", false],
  ["boolean", "is", true, "sí", true],
  ["boolean", "is", false, "false", true],
  ["boolean", "is", true, "no", false],
  ["boolean", "is", false, "pending", false],
  ["boolean", "is", ["true", "false"], "true", false],
  ["number", "contains", 2, "2", false],
  ["number", "between", ["1", "3"], "2", false],
  ["number", "equals", 1.2, "1.2.3", false],
  ["number", "equals", 123, "1,2,3", false],
  ["number", "equals", 1234567, "1,234,567", true],
  ["number", "equals", 1.2345, "1,2345", true],
  ["date", "dateRange", true, "2026-09-01", false],
  ["enum", "equals", "BQ", "BQ", false],
  ["text", "between", [1, 2], "1", false],
  ["text", "isEmpty", null, " ", true],
  ["text", "isNotEmpty", null, " ", false],
  ["text", "equals", "x", "", false],
];
it.each(cases)(
  "filters %s with %s on %s",
  (dataType, operator, value, raw, expected) => {
    expect(
      matchesFilter(
        { data: raw },
        { columnKey: "{{row.data}}", dataType, operator, value },
      ),
    ).toBe(expected);
  },
);
it.each([
  ["text", "contains"],
  ["number", "equals"],
  ["date", "dateRange"],
  ["enum", "in"],
  ["boolean", "is"],
] as const)("defaults %s to %s", (type, operator) =>
  expect(getDefaultOperator(type)).toBe(operator),
);

it.each(["1.2.3", "1,2,3", "1234,567"])(
  "does not infer malformed numeric values: %s",
  (value) => {
    const { result } = renderHook(() =>
      useColumnFilters([{ data: value }], [{ key: "data" }]),
    );
    expect(result.current.resolvedDataTypes.data).toBe("text");
  },
);
