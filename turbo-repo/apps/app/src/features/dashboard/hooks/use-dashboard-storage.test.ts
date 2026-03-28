import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureWidgetDefaults,
  applyLayoutToWidget,
  updateChildrenLayouts,
  stripEphemeralState,
} from "./use-dashboard-storage";
import { makeWidget, makeLayout, makeDashboardStorage } from "../test-fixtures";

// Mock getDashlet to control defaultConfig
vi.mock("../dashlets", () => ({
  getDashlet: vi.fn((id: string) => {
    if (id === "card") {
      return { defaultConfig: { title: "Default Title" } };
    }
    if (id === "container") {
      return { defaultConfig: { variant: "bento-box" } };
    }
    return undefined;
  }),
}));

// ============================================================================
// ensureWidgetDefaults
// ============================================================================

describe("ensureWidgetDefaults", () => {
  it("applies default layout when layout is missing", () => {
    const widget = makeWidget({
      id: "w1",
      componentId: "card",
      layout: undefined as never,
    });
    // Remove layout to simulate missing
    delete (widget as Record<string, unknown>).layout;

    const result = ensureWidgetDefaults(widget, 2);
    expect(result.layout).toEqual({
      i: "w1",
      x: 2, // 2 % 3
      y: 0, // floor(2/3)
      w: 1,
      h: 1,
    });
  });

  it("merges dashlet defaultConfig under widget config", () => {
    const widget = makeWidget({
      componentId: "card",
      config: { custom: "value" },
    });
    const result = ensureWidgetDefaults(widget, 0);
    expect(result.config).toEqual({ title: "Default Title", custom: "value" });
  });

  it("widget config overrides defaultConfig", () => {
    const widget = makeWidget({
      componentId: "card",
      config: { title: "My Title" },
    });
    const result = ensureWidgetDefaults(widget, 0);
    expect(result.config.title).toBe("My Title");
  });

  it("preserves existing layout when present", () => {
    const layout = makeLayout({ i: "w1", x: 5, y: 10, w: 3, h: 2 });
    const widget = makeWidget({ id: "w1", componentId: "card", layout });
    const result = ensureWidgetDefaults(widget, 0);
    expect(result.layout).toEqual(layout);
  });

  it("recursively applies defaults to children", () => {
    const child = makeWidget({
      id: "child-1",
      componentId: "card",
      config: {},
    });
    const parent = makeWidget({
      id: "parent",
      componentId: "container",
      children: [child],
    });
    const result = ensureWidgetDefaults(parent, 0);
    expect(result.children![0].config).toEqual(
      expect.objectContaining({ title: "Default Title" }),
    );
  });

  it("handles unknown componentId gracefully", () => {
    const widget = makeWidget({ componentId: "unknown_widget", config: { a: 1 } });
    const result = ensureWidgetDefaults(widget, 0);
    expect(result.config).toEqual({ a: 1 });
  });
});

// ============================================================================
// applyLayoutToWidget
// ============================================================================

describe("applyLayoutToWidget", () => {
  it("updates layout when matching layout found by widget.id", () => {
    const widget = makeWidget({ id: "w1" });
    const layouts = [{ i: "w1", x: 10, y: 20, w: 3, h: 2 }];
    const result = applyLayoutToWidget(widget, layouts);
    expect(result.layout).toEqual({ i: "w1", x: 10, y: 20, w: 3, h: 2 });
    expect(result.updatedAt).not.toBe(widget.updatedAt);
  });

  it("returns widget unchanged when no matching layout", () => {
    const widget = makeWidget({ id: "w1" });
    const layouts = [{ i: "other", x: 0, y: 0, w: 1, h: 1 }];
    const result = applyLayoutToWidget(widget, layouts);
    expect(result).toBe(widget);
  });

  it("sets updatedAt timestamp", () => {
    const widget = makeWidget({ id: "w1" });
    const layouts = [{ i: "w1", x: 0, y: 0, w: 1, h: 1 }];
    const result = applyLayoutToWidget(widget, layouts);
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(0);
  });
});

// ============================================================================
// updateChildrenLayouts
// ============================================================================

describe("updateChildrenLayouts", () => {
  it("updates children layouts when widget.id matches parentId", () => {
    const child = makeWidget({ id: "child-1" });
    const parent = makeWidget({
      id: "parent",
      children: [child],
    });
    const layouts = [{ i: "child-1", x: 5, y: 5, w: 2, h: 2 }];
    const result = updateChildrenLayouts(parent, "parent", layouts);
    expect(result.children![0].layout).toEqual({
      i: "child-1",
      x: 5,
      y: 5,
      w: 2,
      h: 2,
    });
  });

  it("recursively searches nested children", () => {
    const grandchild = makeWidget({ id: "gc-1" });
    const child = makeWidget({ id: "child-1", children: [grandchild] });
    const root = makeWidget({ id: "root", children: [child] });
    const layouts = [{ i: "gc-1", x: 1, y: 1, w: 1, h: 1 }];
    const result = updateChildrenLayouts(root, "child-1", layouts);
    expect(result.children![0].children![0].layout).toEqual({
      i: "gc-1",
      x: 1,
      y: 1,
      w: 1,
      h: 1,
    });
  });

  it("returns widget unchanged when parentId not found", () => {
    const widget = makeWidget({ id: "w1" });
    const layouts = [{ i: "child", x: 0, y: 0, w: 1, h: 1 }];
    const result = updateChildrenLayouts(widget, "nonexistent", layouts);
    expect(result).toBe(widget);
  });

  it("returns widget unchanged when it has no children", () => {
    const widget = makeWidget({ id: "w1", children: undefined });
    const layouts = [{ i: "child", x: 0, y: 0, w: 1, h: 1 }];
    const result = updateChildrenLayouts(widget, "w1", layouts);
    expect(result).toBe(widget);
  });
});

// ============================================================================
// stripEphemeralState
// ============================================================================

describe("stripEphemeralState", () => {
  it("sets preferences.editMode to false", () => {
    const data = makeDashboardStorage({
      preferences: { editMode: true },
    });
    const result = stripEphemeralState(data);
    expect(result.preferences.editMode).toBe(false);
  });

  it("preserves all other data", () => {
    const data = makeDashboardStorage({
      name: "My Dashboard",
      widgets: [makeWidget()],
      preferences: { editMode: true },
    });
    const result = stripEphemeralState(data);
    expect(result.name).toBe("My Dashboard");
    expect(result.widgets).toHaveLength(1);
    expect(result.version).toBe(2);
  });

  it("does not mutate original data", () => {
    const data = makeDashboardStorage({
      preferences: { editMode: true },
    });
    stripEphemeralState(data);
    expect(data.preferences.editMode).toBe(true);
  });
});
