import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";

// ── Mock values ────────────────────────────────────────────────────────────

let mockRuntimeConfig: { MAP_DEFAULT_TRIP_FILTER: string } | null = null;
let mockHasUrlParamValue = false;

vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => mockRuntimeConfig,
}));

vi.mock("../hooks/use-map-filters", () => ({
  useMapFilters: () => ({
    getInitialActivated: () => false,
    syncFiltersToUrl: vi.fn(),
    hasUrlParam: () => mockHasUrlParamValue,
  }),
}));

// ── Test hook that mirrors Filters component logic ─────────────────────────

interface TripState {
  code: string;
  activated: boolean;
}

/**
 * Extracted hook that mirrors the trip-filter default logic in Filters component.
 * This allows us to test the useEffect behavior in isolation.
 */
function useTripFilterDefault(
  runtimeConfig: { MAP_DEFAULT_TRIP_FILTER: string } | null,
  hasUrlParam: (key: string) => boolean
) {
  const defaultTripFilter = runtimeConfig?.MAP_DEFAULT_TRIP_FILTER === "true";

  const [tripStates, setTripStates] = useState<TripState[]>([
    { code: "1", activated: false },
    { code: "2", activated: false },
  ]);

  const configDefaultApplied = useRef(false);

  useEffect(() => {
    if (configDefaultApplied.current) return;
    if (!runtimeConfig) return;

    // Mark as applied once we've observed runtimeConfig
    configDefaultApplied.current = true;

    // If URL param exists, respect user's explicit choice
    if (hasUrlParam("trip")) return;

    if (defaultTripFilter) {
      setTripStates((prev) =>
        prev.map((state) =>
          state.code === "1" ? { ...state, activated: true } : state
        )
      );
    }
  }, [runtimeConfig, defaultTripFilter, hasUrlParam]);

  return {
    tripStates,
    setTripStates,
    configDefaultApplied,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRuntimeConfig = null;
  mockHasUrlParamValue = false;
});

describe("Trip Filter Default Precedence", () => {
  describe("when no ?trip URL param exists", () => {
    it("applies default trip filter when MAP_DEFAULT_TRIP_FILTER=true", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "true" };
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      await waitFor(() => {
        expect(result.current.tripStates[0].activated).toBe(true);
      });

      expect(result.current.tripStates[0].code).toBe("1");
      expect(result.current.tripStates[0].activated).toBe(true);
      expect(result.current.tripStates[1].activated).toBe(false);
    });

    it("does not apply default trip filter when MAP_DEFAULT_TRIP_FILTER=false", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "false" };
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      await waitFor(() => {
        expect(result.current.configDefaultApplied.current).toBe(true);
      });

      expect(result.current.tripStates[0].activated).toBe(false);
      expect(result.current.tripStates[1].activated).toBe(false);
    });

    it("does not apply default when MAP_DEFAULT_TRIP_FILTER is empty", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "" };
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      await waitFor(() => {
        expect(result.current.configDefaultApplied.current).toBe(true);
      });

      expect(result.current.tripStates[0].activated).toBe(false);
      expect(result.current.tripStates[1].activated).toBe(false);
    });
  });

  describe("when ?trip URL param exists", () => {
    it("does not apply config default when URL param is present", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "true" };
      mockHasUrlParamValue = true;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      await waitFor(() => {
        expect(result.current.configDefaultApplied.current).toBe(true);
      });

      // Default should NOT be applied because URL param takes precedence
      expect(result.current.tripStates[0].activated).toBe(false);
      expect(result.current.tripStates[1].activated).toBe(false);
    });

    it("marks configDefaultApplied even when URL param overrides", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "true" };
      mockHasUrlParamValue = true;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      await waitFor(() => {
        expect(result.current.configDefaultApplied.current).toBe(true);
      });

      // This ensures that clearing the URL param later won't re-trigger the default
      expect(result.current.configDefaultApplied.current).toBe(true);
    });
  });

  describe("clearing trip filter after initial load", () => {
    it("allows tripStates to be deactivated after initial load with default applied", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "true" };
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      // Wait for default to be applied
      await waitFor(() => {
        expect(result.current.tripStates[0].activated).toBe(true);
      });

      // User clears the filter
      act(() => {
        result.current.setTripStates((prev) =>
          prev.map((state) => ({ ...state, activated: false }))
        );
      });

      expect(result.current.tripStates[0].activated).toBe(false);
      expect(result.current.tripStates[1].activated).toBe(false);
    });

    it("does not re-apply default when tripStates are manually cleared", async () => {
      mockRuntimeConfig = { MAP_DEFAULT_TRIP_FILTER: "true" };
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      // Wait for default to be applied
      await waitFor(() => {
        expect(result.current.tripStates[0].activated).toBe(true);
      });

      // User clears the filter
      act(() => {
        result.current.setTripStates((prev) =>
          prev.map((state) => ({ ...state, activated: false }))
        );
      });

      // configDefaultApplied should still be true, preventing re-application
      expect(result.current.configDefaultApplied.current).toBe(true);
      expect(result.current.tripStates[0].activated).toBe(false);
    });
  });

  describe("runtimeConfig loading states", () => {
    it("waits for runtimeConfig before applying default", () => {
      mockRuntimeConfig = null;
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result } = renderHook(() =>
        useTripFilterDefault(mockRuntimeConfig, hasUrlParam)
      );

      // Should not apply anything while config is null
      expect(result.current.configDefaultApplied.current).toBe(false);
      expect(result.current.tripStates[0].activated).toBe(false);
    });

    it("applies default once runtimeConfig becomes available", async () => {
      mockHasUrlParamValue = false;
      const hasUrlParam = () => mockHasUrlParamValue;

      const { result, rerender } = renderHook(
        ({ config, hasParam }) => useTripFilterDefault(config, hasParam),
        {
          initialProps: {
            config: null as { MAP_DEFAULT_TRIP_FILTER: string } | null,
            hasParam: hasUrlParam,
          },
        }
      );

      // Initially null config
      expect(result.current.configDefaultApplied.current).toBe(false);

      // Config becomes available
      rerender({
        config: { MAP_DEFAULT_TRIP_FILTER: "true" },
        hasParam: hasUrlParam,
      });

      await waitFor(() => {
        expect(result.current.tripStates[0].activated).toBe(true);
      });
    });
  });
});
