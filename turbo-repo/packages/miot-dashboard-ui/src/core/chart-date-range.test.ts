import { expect, it } from "vitest";
import {
  filterChartRowsByDateRange,
  type ChartDateRange,
} from "./chart-date-range";

it("uses inclusive rolling cutoffs, keeps future rows and excludes invalid dates", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const rows = [
    { date: "2026-09-23T12:00:00Z" },
    { date: "2026-09-23T11:59:59Z" },
    { date: "2026-09-23T09:00:00-03:00" },
    { date: "2026-10-01T12:00:00Z" },
    { date: "invalid" },
    { date: "" },
  ];
  expect(filterChartRowsByDateRange(rows, "date", "7d", now)).toEqual([
    rows[0],
    rows[2],
    rows[3],
  ]);
  expect(filterChartRowsByDateRange(rows, "missing", "7d", now)).toEqual([]);
  expect(rows).toHaveLength(6);
});

it("preserves all rows for unbounded or unknown stored ranges", () => {
  const rows = [{ date: "invalid" }];
  for (const range of ["all", "missing", "constructor", "__proto__"]) {
    expect(
      filterChartRowsByDateRange(rows, "date", range as ChartDateRange),
    ).toBe(rows);
  }
});

it.each([
  ["30d", 30],
  ["90d", 90],
  ["180d", 180],
  ["1y", 365],
] as const)("preserves the %s duration", (range, days) => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const cutoff = now - days * 86_400_000;
  const rows = [
    { date: new Date(cutoff).toISOString() },
    { date: new Date(cutoff - 1).toISOString() },
  ];
  expect(filterChartRowsByDateRange(rows, "date", range, now)).toEqual([
    rows[0],
  ]);
});
