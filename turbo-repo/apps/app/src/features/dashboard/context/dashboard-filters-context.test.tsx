import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { makeFilterParam } from "../test-fixtures";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockFilters = [makeFilterParam({ key: "status", label: "Status", type: "text" })];

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard",
}));

vi.mock("./dashboard-context", () => ({
  useDashboard: () => ({ filters: mockFilters }),
}));

const { DashboardFiltersProvider, useDashboardFilters } = await import(
  "./dashboard-filters-context"
);

function wrapper({ children }: { children: React.ReactNode }) {
  return <DashboardFiltersProvider>{children}</DashboardFiltersProvider>;
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams();
  mockFilters = [makeFilterParam({ key: "status", label: "Status", type: "text" })];
});

// ============================================================================
// useDashboardFilters
// ============================================================================

describe("useDashboardFilters", () => {
  it("provides empty activeFilters when no URL params match", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    expect(result.current.activeFilters).toEqual({});
  });

  it("reads active filters from URL search params", () => {
    mockSearchParams = new URLSearchParams("status=active");
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    expect(result.current.activeFilters).toEqual({ status: "active" });
  });

  it("handles date_range type (expands to _from/_to keys)", () => {
    mockFilters = [
      makeFilterParam({ key: "date_range", label: "Date", type: "date_range" }),
    ];
    mockSearchParams = new URLSearchParams(
      "date_range_from=2025-01-01&date_range_to=2025-12-31",
    );
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    expect(result.current.activeFilters).toEqual({
      date_range_from: "2025-01-01",
      date_range_to: "2025-12-31",
    });
  });

  it("adds default date_range_from/to when no date_range filter configured", () => {
    mockFilters = [makeFilterParam({ key: "status", type: "text" })];
    mockSearchParams = new URLSearchParams("date_range_from=2025-01-01");
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    expect(result.current.activeFilters).toEqual({
      date_range_from: "2025-01-01",
    });
  });

  // ── setFilter ──────────────────────────────────────────────────────────

  describe("setFilter", () => {
    it("sets URL param via router.replace", () => {
      const { result } = renderHook(() => useDashboardFilters(), { wrapper });
      act(() => {
        result.current.setFilter("status", "active");
      });
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard?status=active",
        { scroll: false },
      );
    });

    it("removes param when value is empty", () => {
      mockSearchParams = new URLSearchParams("status=active");
      const { result } = renderHook(() => useDashboardFilters(), { wrapper });
      act(() => {
        result.current.setFilter("status", "");
      });
      expect(mockReplace).toHaveBeenCalledWith("/dashboard", { scroll: false });
    });

    it("clears other params for unique filter", () => {
      mockFilters = [
        makeFilterParam({ key: "asset", type: "text", unique: true }),
      ];
      mockSearchParams = new URLSearchParams("asset=old");
      const { result } = renderHook(() => useDashboardFilters(), { wrapper });
      act(() => {
        result.current.setFilter("asset", "new");
      });
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("asset=new"),
        { scroll: false },
      );
    });
  });

  // ── removeFilter ───────────────────────────────────────────────────────

  describe("removeFilter", () => {
    it("removes single URL param via router.replace", () => {
      mockSearchParams = new URLSearchParams("status=active&other=x");
      const { result } = renderHook(() => useDashboardFilters(), { wrapper });
      act(() => {
        result.current.removeFilter("status");
      });
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard?other=x",
        { scroll: false },
      );
    });
  });

  // ── clearFilters ───────────────────────────────────────────────────────

  describe("clearFilters", () => {
    it("removes all configured filter keys from URL", () => {
      mockSearchParams = new URLSearchParams("status=active");
      const { result } = renderHook(() => useDashboardFilters(), { wrapper });
      act(() => {
        result.current.clearFilters();
      });
      // "status" removed, default date_range keys also removed (but weren't present)
      expect(mockReplace).toHaveBeenCalledWith("/dashboard", { scroll: false });
    });

    it("preserves non-filter URL params", () => {
      mockSearchParams = new URLSearchParams("status=active&tab=overview");
      const { result } = renderHook(() => useDashboardFilters(), { wrapper });
      act(() => {
        result.current.clearFilters();
      });
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard?tab=overview",
        { scroll: false },
      );
    });
  });
});
