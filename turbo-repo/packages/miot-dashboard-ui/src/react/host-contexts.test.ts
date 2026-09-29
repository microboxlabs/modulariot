// @vitest-environment jsdom
import { createElement, useState, type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  DashboardFiltersProvider,
  useDashboardFilters,
} from "./filter-context";
import { useDashboardFilterState } from "./filter-state";
import {
  PlannerResultsProvider,
  usePlannerContext,
  useOptionalPlannerContext,
  type PlannerContextValue,
} from "./planner-results";

afterEach(cleanup);

it("isolates controlled filters and preserves unrelated host values", () => {
  const { result } = renderHook(() => {
    const [values, onChange] = useState<Record<string, string>>({
      status: "active",
      tab: "overview",
      date_range_from: "2026-01-01",
    });
    const [other, setOther] = useState<Record<string, string>>({
      status: "other",
    });
    const definitions = [
      { key: "status", label: "Status", type: "text" as const },
    ];
    return {
      first: useDashboardFilterState({ definitions, values, onChange }),
      second: useDashboardFilterState({
        definitions,
        values: other,
        onChange: setOther,
      }),
    };
  });
  act(() => result.current.first.setFilter("status", "changed"));
  expect(result.current.first.activeFilters.status).toBe("changed");
  expect(result.current.second.activeFilters.status).toBe("other");
  act(() => result.current.first.setFilter("__proto__", "ordinary value"));
  expect(
    Object.getOwnPropertyDescriptor(
      result.current.first.activeFilters,
      "__proto__",
    )?.value,
  ).toBe("ordinary value");
  expect(Object.getPrototypeOf(result.current.first.activeFilters)).toBe(
    Object.prototype,
  );
  act(() => result.current.first.removeFilter("__proto__"));
  act(() => result.current.first.clearFilters());
  expect(result.current.first.activeFilters).toEqual({ tab: "overview" });
});

it("clears a unique date-range group and removes empty values", () => {
  const { result } = renderHook(() => {
    const [values, onChange] = useState<Record<string, string>>({
      range_from: "old",
      range_to: "old",
      unused: "",
    });
    return useDashboardFilterState({
      definitions: [
        { key: "range", label: "Range", type: "date_range", unique: true },
      ],
      values,
      onChange,
    });
  });
  act(() => result.current.setFilter("range_from", "new"));
  expect(result.current.activeFilters).toEqual({ range_from: "new" });
  act(() => result.current.setFilter("range_from", ""));
  expect(result.current.activeFilters).toEqual({});
});

it("provides filters through the host context", () => {
  function Host({ children }: Readonly<PropsWithChildren>) {
    const [values, onChange] = useState<Record<string, string>>({
      status: "active",
    });
    return createElement(
      DashboardFiltersProvider,
      { controller: { definitions: [], values, onChange } },
      children,
    );
  }
  const { result } = renderHook(useDashboardFilters, { wrapper: Host });
  expect(result.current.activeFilters.status).toBe("active");
  act(() => result.current.removeFilter("status"));
  expect(result.current.activeFilters).toEqual({});
});

it("provides isolated empty optional contexts outside a host", () => {
  const a = renderHook(() => ({
    filters: useDashboardFilters(),
    planner: useOptionalPlannerContext(),
  }));
  const b = renderHook(() => ({
    filters: useDashboardFilters(),
    planner: useOptionalPlannerContext(),
  }));
  expect(a.result.current.filters.activeFilters).not.toBe(
    b.result.current.filters.activeFilters,
  );
  expect(a.result.current.planner.results).not.toBe(
    b.result.current.planner.results,
  );
  act(() => {
    a.result.current.filters.setFilter("a", "b");
    a.result.current.filters.removeFilter("a");
    a.result.current.filters.clearFilters();
  });
  expect(a.result.current.filters.activeFilters).toEqual({});
});

it("isolates same-name planner results", () => {
  const value: PlannerContextValue = {
    results: new Map([
      ["costs", { rows: [{ cost: "10" }], loading: false, error: null }],
    ]),
    definitions: [],
    schemas: new Map([["costs", ["cost"]]]),
  };
  const other: PlannerContextValue = {
    ...value,
    results: new Map([
      ["costs", { rows: [{ cost: "20" }], loading: false, error: null }],
    ]),
  };
  const first = renderHook(usePlannerContext, {
    wrapper: ({ children }: Readonly<PropsWithChildren>) =>
      createElement(PlannerResultsProvider, { value }, children),
  });
  const second = renderHook(useOptionalPlannerContext, {
    wrapper: ({ children }: Readonly<PropsWithChildren>) =>
      createElement(PlannerResultsProvider, { value: other }, children),
  });
  expect(first.result.current.results.get("costs")?.rows[0]?.cost).toBe("10");
  expect(second.result.current.results.get("costs")?.rows[0]?.cost).toBe("20");
});

it("requires a host for the strict planner hook", () => {
  expect(() => renderHook(usePlannerContext)).toThrow("PlannerResultsProvider");
});

it("does not clear separately configured filters that share a prefix", () => {
  const { result } = renderHook(() => {
    const [values, onChange] = useState<Record<string, string>>({
      asset: "old",
      asset_type: "truck",
    });
    return useDashboardFilterState({
      definitions: [
        { key: "asset", label: "Asset", type: "text", unique: true },
        { key: "asset_type", label: "Type", type: "text" },
      ],
      values,
      onChange,
    });
  });
  act(() => result.current.setFilter("asset_type", "van"));
  expect(result.current.activeFilters).toEqual({
    asset: "old",
    asset_type: "van",
  });
  act(() => result.current.setFilter("asset", "new"));
  expect(result.current.activeFilters).toEqual({
    asset: "new",
    asset_type: "van",
  });
});
