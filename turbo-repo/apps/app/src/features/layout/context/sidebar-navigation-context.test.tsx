import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  SidebarNavigationProvider,
  useSidebarNavigation,
} from "./sidebar-navigation-context";
import { pages } from "../models/pages";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/features/dashboard/hooks/use-dashboard-dynamic-items", () => ({
  useDashboardDynamicItems: () => [],
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useMyTasksCount: vi.fn(),
  useHistoricInstancesCount: vi.fn(),
  useMapPositions: vi.fn(),
  useSymptoms: vi.fn(),
  useUserFilters: vi.fn(),
  useCalendars: vi.fn(() => ({ calendars: [], isLoading: false, error: null })),
  useUserSite: vi.fn(() => ({ siteName: "test" })),
  getMyTasks: vi.fn(),
}));

vi.mock("@/features/task-forms/services/form.service", () => ({
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2: ["shippingTask"],
  DELIVERY_COORDINATOR_PROCESS_TASKS: ["deliveryTask"],
  PLANNING_COORDINATOR_PROCESS_TASKS: ["planningTask"],
}));

vi.mock("@/features/task-forms/services/form.service.types", () => ({}));

import {
  useMyTasksCount,
  useHistoricInstancesCount,
  useMapPositions,
  useSymptoms,
  useUserFilters,
  getMyTasks,
} from "@/features/common/providers/client-api.provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetcherError(status: number) {
  return Object.assign(new Error("fetch error"), { info: null, status });
}

function setDefaultMocks({
  mapCount = 0,
  symptomsCount = 0,
  taskTotals = {},
  historicTotals = {},
  filters = [],
  error = undefined,
}: {
  mapCount?: number;
  symptomsCount?: number;
  taskTotals?: Record<string, number>;
  historicTotals?: Record<string, number>;
  filters?: string[];
  error?: { status: number };
} = {}) {
  // TaskCountResponse.totals is typed as { totalTasks: number } but the real
  // API returns arbitrary process-task keys. Use unknown intermediary to avoid
  // constructing the full type shape in test mocks.
  vi.mocked(useMyTasksCount).mockReturnValue({
    data: { totals: taskTotals } as unknown as ReturnType<typeof useMyTasksCount>["data"],
    error: error ? makeFetcherError(error.status) : undefined,
    isLoading: false,
  });
  vi.mocked(useHistoricInstancesCount).mockReturnValue({
    data: { totals: historicTotals },
    error: undefined,
    isLoading: false,
  });
  vi.mocked(useMapPositions).mockReturnValue({
    count: mapCount,
    positions: [],
    isLoading: false,
    isError: false,
    error: undefined,
    mutate: vi.fn(),
  });
  vi.mocked(useSymptoms).mockReturnValue({
    count: symptomsCount,
    symptoms: undefined,
    loading: false,
    error: undefined,
  });
  vi.mocked(useUserFilters).mockReturnValue({
    data: filters,
    error: undefined,
    isLoading: false,
  });
  // context only reads .total — provide the minimum required shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getMyTasks).mockResolvedValue({ total: 0 } as any);
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SidebarNavigationProvider>{children}</SidebarNavigationProvider>
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSidebarNavigation", () => {
  it("throws when used outside SidebarNavigationProvider", () => {
    expect(() => renderHook(() => useSidebarNavigation())).toThrow(
      "useSidebarNavigation must be used within SidebarNavigationProvider"
    );
  });
});

describe("SidebarNavigationProvider", () => {
  beforeEach(() => {
    setDefaultMocks();
  });

  it("provides items and totals to consumers", () => {
    const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
    expect(result.current.items).toBeDefined();
    expect(result.current.totals).toBeDefined();
  });

  it("exposes all pages as items", () => {
    const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
    expect(result.current.items).toHaveLength(pages.length);
  });

  describe("pages immutability", () => {
    it("does not mutate the pages constant when there are no dynamic items", () => {
      const tasksPage = pages.find((p) => p.label === "tasks");
      const staticItemCount = tasksPage?.items?.length ?? 0;

      renderHook(() => useSidebarNavigation(), { wrapper });

      expect(tasksPage?.items?.length).toBe(staticItemCount);
    });

    it("does not mutate the pages constant when dynamic items are present", async () => {
      const tasksPage = pages.find((p) => p.label === "tasks");
      const staticItemCount = tasksPage?.items?.length ?? 0;

      setDefaultMocks({
        filters: ["titleLabel=My Filter&position=0"],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(getMyTasks).mockResolvedValue({ total: 7 } as any);

      renderHook(() => useSidebarNavigation(), { wrapper });

      await waitFor(() => {
        expect(vi.mocked(getMyTasks)).toHaveBeenCalled();
      });

      // Original pages export must be unchanged
      expect(tasksPage?.items?.length).toBe(staticItemCount);
    });
  });

  describe("resolved items", () => {
    it("returns static items unchanged for pages without dynamicItemsSource", () => {
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      const homeItem = result.current.items.find((i) => i.label === "home");
      const original = pages.find((p) => p.label === "home");
      expect(homeItem?.items).toEqual(original?.items);
    });

    it("appends dynamic items after static items in tasks section", async () => {
      setDefaultMocks({
        filters: ["titleLabel=My Filter&position=0"],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(getMyTasks).mockResolvedValue({ total: 5 } as any);

      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });

      await waitFor(() => {
        const tasksItem = result.current.items.find((i) => i.label === "tasks");
        // 2 static + 1 dynamic
        expect(tasksItem?.items?.length).toBe(3);
      });
    });

    it("dynamic items are sorted by position", async () => {
      setDefaultMocks({
        filters: [
          "titleLabel=Second Filter&position=1",
          "titleLabel=First Filter&position=0",
        ],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(getMyTasks).mockResolvedValue({ total: 1 } as any);

      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });

      await waitFor(() => {
        const tasksItem = result.current.items.find((i) => i.label === "tasks");
        const dynamicItems = tasksItem?.items?.slice(2); // after 2 static items
        expect(dynamicItems?.[0]?.label).toBe("First Filter");
        expect(dynamicItems?.[1]?.label).toBe("Second Filter");
      });
    });
  });

  describe("totals computation", () => {
    it("maps geographicView from mapCount", () => {
      setDefaultMocks({ mapCount: 42 });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.geographicView).toBe(42);
    });

    it("maps symptoms from symptomsCount", () => {
      setDefaultMocks({ symptomsCount: 17 });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.symptoms).toBe(17);
    });

    it("maps finished and completed_tasks from historic instances total", () => {
      setDefaultMocks({ historicTotals: { type1: 10, type2: 5 } });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.finished).toBe(15);
      expect(result.current.totals.completed_tasks).toBe(15);
    });

    it("sets signalHistory to the dash placeholder", () => {
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.signalHistory).toBe("-");
    });

    it("computes shipping from matching task keys", () => {
      setDefaultMocks({ taskTotals: { shippingTask: 8, deliveryTask: 3 } });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.shipping).toBe(8);
    });

    it("computes delivery from matching task keys", () => {
      setDefaultMocks({ taskTotals: { shippingTask: 8, deliveryTask: 3 } });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.delivery).toBe(3);
    });

    it("pending_tasks equals delivery + shipping", () => {
      setDefaultMocks({ taskTotals: { shippingTask: 4, deliveryTask: 6 } });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.pending_tasks).toBe(10);
    });

    it("skips shipping/delivery/planning totals when there is an error", () => {
      setDefaultMocks({
        error: { status: 403 },
        taskTotals: { shippingTask: 99 },
      });
      const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
      expect(result.current.totals.shipping).toBeUndefined();
      expect(result.current.totals.delivery).toBeUndefined();
    });
  });
});
