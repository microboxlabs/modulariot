import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { makePlannerDefinition } from "../test-fixtures";
import type { PlannerRequestDefinition } from "../types/dashboard.types";

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockPlannerDefinitions: PlannerRequestDefinition[] = [];
const mockUpdatePlannerRequest = vi.fn();
let mockActiveFilters: Record<string, string> = {};

vi.mock("./dashboard-context", () => ({
  useDashboard: () => ({
    plannerDefinitions: mockPlannerDefinitions,
    updatePlannerRequest: mockUpdatePlannerRequest,
  }),
}));

vi.mock("./dashboard-filters-context", () => ({
  useDashboardFilters: () => ({
    activeFilters: mockActiveFilters,
  }),
}));

vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ col_a: "val1", col_b: "val2" }]),
    }),
  ),
);

const { PlannerProvider, usePlannerContext } = await import("./planner-context");

function wrapper({ children }: { children: React.ReactNode }) {
  return <PlannerProvider>{children}</PlannerProvider>;
}

beforeEach(() => {
  mockPlannerDefinitions = [];
  mockActiveFilters = {};
  mockUpdatePlannerRequest.mockClear();
  vi.mocked(fetch).mockClear();
  vi.mocked(fetch).mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ col_a: "val1", col_b: "val2" }]),
    } as Response),
  );
});

// ============================================================================
// PlannerProvider
// ============================================================================

describe("PlannerProvider", () => {
  it("returns empty results when no definitions", () => {
    const { result } = renderHook(() => usePlannerContext(), { wrapper });
    expect(result.current.results.size).toBe(0);
  });

  it("fetches all planner definitions in parallel", async () => {
    mockPlannerDefinitions = [
      makePlannerDefinition({ id: "d1", variableName: "var1", pgrestFunctionName: "fn1" }),
      makePlannerDefinition({ id: "d2", variableName: "var2", pgrestFunctionName: "fn2" }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.results.get("var1")?.loading).toBe(false);
      expect(result.current.results.get("var2")?.loading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("populates results with parsed rows on success", async () => {
    mockPlannerDefinitions = [
      makePlannerDefinition({ id: "d1", variableName: "fleet", pgrestFunctionName: "get_fleet" }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      const r = result.current.results.get("fleet");
      expect(r?.loading).toBe(false);
      expect(r?.rows).toHaveLength(1);
      expect(r?.rows[0].col_a).toBe("val1");
    });
  });

  it("sets error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network down"));
    mockPlannerDefinitions = [
      makePlannerDefinition({ id: "d1", variableName: "fleet", pgrestFunctionName: "get_fleet" }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      const r = result.current.results.get("fleet");
      expect(r?.loading).toBe(false);
      expect(r?.error).toBe("Network down");
    });
  });

  it("sets error on non-OK HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);
    mockPlannerDefinitions = [
      makePlannerDefinition({ id: "d1", variableName: "fleet", pgrestFunctionName: "get_fleet" }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      const r = result.current.results.get("fleet");
      expect(r?.error).toBe("HTTP 500");
    });
  });

  it("skips definitions without pgrestFunctionName", async () => {
    mockPlannerDefinitions = [
      makePlannerDefinition({ id: "d1", variableName: "empty", pgrestFunctionName: "" }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      const r = result.current.results.get("empty");
      expect(r?.rows).toEqual([]);
      expect(r?.error).toBeNull();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("persists schema when new columns detected", async () => {
    mockPlannerDefinitions = [
      makePlannerDefinition({
        id: "d1",
        variableName: "fleet",
        pgrestFunctionName: "get_fleet",
        schema: undefined,
      }),
    ];

    renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      expect(mockUpdatePlannerRequest).toHaveBeenCalledWith("d1", {
        schema: ["col_a", "col_b"],
      });
    });
  });

  it("does not update schema when it hasn't changed", async () => {
    mockPlannerDefinitions = [
      makePlannerDefinition({
        id: "d1",
        variableName: "fleet",
        pgrestFunctionName: "get_fleet",
        schema: ["col_a", "col_b"],
      }),
    ];

    renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(mockUpdatePlannerRequest).not.toHaveBeenCalled();
  });

  it("derives schemas from first row of results", async () => {
    mockPlannerDefinitions = [
      makePlannerDefinition({ id: "d1", variableName: "fleet", pgrestFunctionName: "get_fleet" }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.schemas.get("fleet")).toEqual(["col_a", "col_b"]);
    });
  });

  it("falls back to persisted schema when results empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    mockPlannerDefinitions = [
      makePlannerDefinition({
        id: "d1",
        variableName: "fleet",
        pgrestFunctionName: "get_fleet",
        schema: ["saved_col"],
      }),
    ];

    const { result } = renderHook(() => usePlannerContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.results.get("fleet")?.loading).toBe(false);
    });

    expect(result.current.schemas.get("fleet")).toEqual(["saved_col"]);
  });
});

// ============================================================================
// usePlannerContext outside provider
// ============================================================================

describe("usePlannerContext", () => {
  it("throws when used outside PlannerProvider", () => {
    // Suppress console.error for expected throw
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => usePlannerContext());
    }).toThrow("usePlannerContext must be used within a PlannerProvider");
    spy.mockRestore();
  });
});
