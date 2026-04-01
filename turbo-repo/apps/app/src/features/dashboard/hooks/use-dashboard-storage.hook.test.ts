import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { makeWidget, makeDashboardStorage } from "../test-fixtures";
import type { DashboardStorageSchema } from "../types/dashboard.types";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockMutate = vi.fn();
let mockSwrData: { data: DashboardStorageSchema | null } = { data: null };
let mockIsLoading = false;

vi.mock("swr", () => ({
  default: vi.fn(() => ({
    data: mockSwrData,
    mutate: mockMutate,
    isLoading: mockIsLoading,
  })),
}));

vi.mock("@/features/common/providers/fetcher", () => ({
  default: vi.fn(),
}));

vi.mock("../dashlets", () => ({
  getDashlet: vi.fn((id: string) => {
    if (id === "card") {
      return { defaultConfig: { title: "Default" }, getLayoutDefaults: () => ({ minW: 4, minH: 3 }), meta: { hasChildren: false } };
    }
    if (id === "container") {
      return { defaultConfig: { variant: "bento-box" }, getLayoutDefaults: () => ({ minW: 12, minH: 6 }), meta: { hasChildren: true } };
    }
    return undefined;
  }),
}));

vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });
vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));

// Must import AFTER mocks are set up
const { useDashboardStorage } = await import("./use-dashboard-storage");

beforeEach(() => {
  vi.useFakeTimers();
  mockSwrData = { data: makeDashboardStorage() };
  mockIsLoading = false;
  mockMutate.mockClear();
  vi.mocked(fetch).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================================
// Basic hook behavior
// ============================================================================

describe("useDashboardStorage", () => {
  it("returns widgets from SWR response", () => {
    const widget = makeWidget({ id: "w1", componentId: "card" });
    mockSwrData = { data: makeDashboardStorage({ widgets: [widget] }) };
    const { result } = renderHook(() => useDashboardStorage("test-slug"));
    expect(result.current.widgets).toHaveLength(1);
  });

  it("applies ensureWidgetDefaults to all widgets", () => {
    const widget = makeWidget({ id: "w1", componentId: "card", config: {} });
    mockSwrData = { data: makeDashboardStorage({ widgets: [widget] }) };
    const { result } = renderHook(() => useDashboardStorage("test-slug"));
    expect(result.current.widgets[0].config).toHaveProperty("title", "Default");
  });

  it("isLoaded is true when swrKey is null (no siteId)", () => {
    const { result } = renderHook(() => useDashboardStorage("test-slug"));
    expect(result.current.isLoaded).toBe(true);
  });

  it("isLoaded reflects SWR isLoading when siteId provided", () => {
    mockIsLoading = true;
    const { result } = renderHook(() =>
      useDashboardStorage("test-slug", null, "site-1"),
    );
    expect(result.current.isLoaded).toBe(false);
  });

  // ── addWidget ──────────────────────────────────────────────────────────

  describe("addWidget", () => {
    it("appends widget to root widgets and calls mutate", () => {
      mockSwrData = { data: makeDashboardStorage({ widgets: [] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      const newWidget = makeWidget({ id: "new-1", componentId: "card" });
      act(() => {
        result.current.addWidget(newWidget);
      });

      expect(mockMutate).toHaveBeenCalled();
      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets).toHaveLength(1);
      expect(mutateArg.data.widgets[0].id).toBe("new-1");
    });
  });

  // ── addChildWidget ─────────────────────────────────────────────────────

  describe("addChildWidget", () => {
    it("adds widget as child of target parent", () => {
      const parent = makeWidget({
        id: "parent-1",
        componentId: "container",
        children: [],
      });
      mockSwrData = { data: makeDashboardStorage({ widgets: [parent] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      const child = makeWidget({ id: "child-1", componentId: "card" });
      act(() => {
        result.current.addChildWidget("parent-1", child);
      });

      expect(mockMutate).toHaveBeenCalled();
      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets[0].children).toHaveLength(1);
      expect(mutateArg.data.widgets[0].children![0].id).toBe("child-1");
    });
  });

  // ── updateWidgetConfig ─────────────────────────────────────────────────

  describe("updateWidgetConfig", () => {
    it("updates config for target widget", () => {
      const widget = makeWidget({ id: "w1", componentId: "card", config: { title: "Old" } });
      mockSwrData = { data: makeDashboardStorage({ widgets: [widget] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      act(() => {
        result.current.updateWidgetConfig("w1", { title: "New" });
      });

      expect(mockMutate).toHaveBeenCalled();
      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets[0].config.title).toBe("New");
    });
  });

  // ── deleteWidget ───────────────────────────────────────────────────────

  describe("deleteWidget", () => {
    it("removes widget from root", () => {
      const widget = makeWidget({ id: "w1", componentId: "card" });
      mockSwrData = { data: makeDashboardStorage({ widgets: [widget] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      act(() => {
        result.current.deleteWidget("w1");
      });

      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets).toHaveLength(0);
    });

    it("removes nested widget", () => {
      const child = makeWidget({ id: "child-1", componentId: "card" });
      const parent = makeWidget({
        id: "parent-1",
        componentId: "container",
        children: [child],
      });
      mockSwrData = { data: makeDashboardStorage({ widgets: [parent] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      act(() => {
        result.current.deleteWidget("child-1");
      });

      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets[0].children).toHaveLength(0);
    });
  });

  // ── updateWidgetLayouts ────────────────────────────────────────────────

  describe("updateWidgetLayouts", () => {
    it("updates root layouts when parentId is null", () => {
      const widget = makeWidget({ id: "w1", componentId: "card" });
      mockSwrData = { data: makeDashboardStorage({ widgets: [widget] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      act(() => {
        result.current.updateWidgetLayouts(null, [
          { i: "w1", x: 10, y: 20, w: 3, h: 2 },
        ]);
      });

      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets[0].layout.x).toBe(10);
    });

    it("updates children layouts when parentId provided", () => {
      const child = makeWidget({ id: "child-1", componentId: "card" });
      const parent = makeWidget({
        id: "parent-1",
        componentId: "container",
        children: [child],
      });
      mockSwrData = { data: makeDashboardStorage({ widgets: [parent] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      act(() => {
        result.current.updateWidgetLayouts("parent-1", [
          { i: "child-1", x: 5, y: 5, w: 2, h: 2 },
        ]);
      });

      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.widgets[0].children![0].layout.x).toBe(5);
    });
  });

  // ── importDashboard ────────────────────────────────────────────────────

  describe("importDashboard", () => {
    it("returns { success: true } for valid JSON", () => {
      mockSwrData = { data: makeDashboardStorage() };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      const validJson = JSON.stringify(
        makeDashboardStorage({ widgets: [makeWidget()] }),
      );
      let importResult: { success: boolean; error?: string };
      act(() => {
        importResult = result.current.importDashboard(validJson);
      });
      expect(importResult!.success).toBe(true);
    });

    it("returns { success: false } for invalid JSON", () => {
      const { result } = renderHook(() => useDashboardStorage("test-slug"));
      let importResult: { success: boolean; error?: string };
      act(() => {
        importResult = result.current.importDashboard("not json{{{");
      });
      expect(importResult!.success).toBe(false);
    });

    it("returns { success: false } for missing version/widgets", () => {
      const { result } = renderHook(() => useDashboardStorage("test-slug"));
      let importResult: { success: boolean; error?: string };
      act(() => {
        importResult = result.current.importDashboard(JSON.stringify({ name: "test" }));
      });
      expect(importResult!.success).toBe(false);
      expect(importResult!.error).toBe("Invalid dashboard format");
    });

    it("returns { success: false } for wrong version", () => {
      const { result } = renderHook(() => useDashboardStorage("test-slug"));
      let importResult: { success: boolean; error?: string };
      act(() => {
        importResult = result.current.importDashboard(
          JSON.stringify({ version: 1, widgets: [] }),
        );
      });
      expect(importResult!.success).toBe(false);
      expect(importResult!.error).toContain("Unsupported version");
    });
  });

  // ── Debounced Alfresco save ────────────────────────────────────────────

  describe("debounced Alfresco save", () => {
    it("debounces multiple saves to a single PUT", () => {
      mockSwrData = { data: makeDashboardStorage() };
      const { result } = renderHook(() =>
        useDashboardStorage("test-slug", null, "site-1"),
      );

      act(() => {
        result.current.addWidget(makeWidget({ id: "w1" }));
      });
      act(() => {
        result.current.addWidget(makeWidget({ id: "w2" }));
      });

      // Before debounce timer fires
      expect(fetch).not.toHaveBeenCalled();

      // Advance timer past debounce
      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        "/app/api/dashboard/config",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("retries on failure with exponential backoff", async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true } as Response);

      mockSwrData = { data: makeDashboardStorage() };
      const { result } = renderHook(() =>
        useDashboardStorage("test-slug", null, "site-1"),
      );

      act(() => {
        result.current.addWidget(makeWidget({ id: "w1" }));
      });

      // Fire debounce
      await act(async () => {
        vi.advanceTimersByTime(2500);
        // Allow retry delay (1000ms base)
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── findWidget ─────────────────────────────────────────────────────────

  describe("findWidget", () => {
    it("finds root-level widget", () => {
      const widget = makeWidget({ id: "w1", componentId: "card" });
      mockSwrData = { data: makeDashboardStorage({ widgets: [widget] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));
      expect(result.current.findWidget("w1")).toBeDefined();
    });

    it("returns undefined for nonexistent widget", () => {
      mockSwrData = { data: makeDashboardStorage({ widgets: [] }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));
      expect(result.current.findWidget("missing")).toBeUndefined();
    });
  });

  // ── setDashboardName ───────────────────────────────────────────────────

  describe("setDashboardName", () => {
    it("updates dashboard name", () => {
      mockSwrData = { data: makeDashboardStorage({ name: "Old Name" }) };
      const { result } = renderHook(() => useDashboardStorage("test-slug"));

      act(() => {
        result.current.setDashboardName("New Name");
      });

      const mutateArg = mockMutate.mock.calls[0][0] as { data: DashboardStorageSchema };
      expect(mutateArg.data.name).toBe("New Name");
    });
  });
});
