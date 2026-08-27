import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PlannerQueryResult } from "../context/planner-context";
import type { DashboardFilterParam } from "../types/dashboard.types";

let mockResults = new Map<string, PlannerQueryResult>();

vi.mock("../context/planner-context", () => ({
  useOptionalPlannerContext: () => ({
    results: mockResults,
    definitions: [],
    schemas: new Map(),
  }),
}));

const { useFilterOptions } = await import("./use-filter-options");

function setRows(variableName: string, result: Partial<PlannerQueryResult>) {
  mockResults = new Map([
    [variableName, { rows: [], loading: false, error: null, ...result }],
  ]);
}

const SELECT: DashboardFilterParam = {
  key: "symptom_name",
  label: "Nombre del síntoma",
  type: "select",
};

describe("useFilterOptions", () => {
  it("returns hand-typed options when no source is configured", () => {
    mockResults = new Map();
    const filter = { ...SELECT, options: [{ label: "Alta", value: "high" }] };
    const { result } = renderHook(() => useFilterOptions(filter));

    expect(result.current.dynamic).toBe(false);
    expect(result.current.options).toEqual([{ label: "Alta", value: "high" }]);
  });

  it("projects planner rows into options, deduped and in row order", () => {
    setRows("symptoms", {
      rows: [
        { code: "TEMP", name: "Temperatura alta" },
        { code: "PRES", name: "Presión baja" },
        { code: "TEMP", name: "Temperatura alta" },
      ],
    });
    const filter: DashboardFilterParam = {
      ...SELECT,
      optionsSource: { variableName: "symptoms", valueField: "code", labelField: "name" },
    };
    const { result } = renderHook(() => useFilterOptions(filter));

    expect(result.current.dynamic).toBe(true);
    expect(result.current.options).toEqual([
      { label: "Temperatura alta", value: "TEMP" },
      { label: "Presión baja", value: "PRES" },
    ]);
  });

  it("falls back to the value when the label field is missing or blank", () => {
    setRows("symptoms", { rows: [{ code: "TEMP", name: "" }, { code: "PRES" }] });
    const filter: DashboardFilterParam = {
      ...SELECT,
      optionsSource: { variableName: "symptoms", valueField: "code", labelField: "name" },
    };
    const { result } = renderHook(() => useFilterOptions(filter));

    expect(result.current.options).toEqual([
      { label: "TEMP", value: "TEMP" },
      { label: "PRES", value: "PRES" },
    ]);
  });

  it("uses the value field as label when no label field is set", () => {
    setRows("symptoms", { rows: [{ code: "TEMP" }] });
    const filter: DashboardFilterParam = {
      ...SELECT,
      optionsSource: { variableName: "symptoms", valueField: "code" },
    };
    const { result } = renderHook(() => useFilterOptions(filter));

    expect(result.current.options).toEqual([{ label: "TEMP", value: "TEMP" }]);
  });

  it("drops rows whose value cell is blank", () => {
    setRows("symptoms", { rows: [{ code: "" }, { code: "TEMP" }] });
    const filter: DashboardFilterParam = {
      ...SELECT,
      optionsSource: { variableName: "symptoms", valueField: "code" },
    };
    const { result } = renderHook(() => useFilterOptions(filter));

    expect(result.current.options).toEqual([{ label: "TEMP", value: "TEMP" }]);
  });

  it("surfaces the loading and error state of the backing variable", () => {
    setRows("symptoms", { loading: true });
    const filter: DashboardFilterParam = {
      ...SELECT,
      optionsSource: { variableName: "symptoms", valueField: "code" },
    };
    const { result, rerender } = renderHook(() => useFilterOptions(filter));
    expect(result.current.loading).toBe(true);
    expect(result.current.options).toEqual([]);

    setRows("symptoms", { error: "HTTP 500" });
    rerender();
    expect(result.current.error).toBe("HTTP 500");
  });

  it("stays empty and dynamic when the variable has no result yet", () => {
    mockResults = new Map();
    const filter: DashboardFilterParam = {
      ...SELECT,
      options: [{ label: "Alta", value: "high" }],
      optionsSource: { variableName: "symptoms", valueField: "code" },
    };
    const { result } = renderHook(() => useFilterOptions(filter));

    expect(result.current.dynamic).toBe(true);
    expect(result.current.options).toEqual([]);
  });
});
