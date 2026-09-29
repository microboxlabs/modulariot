// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useDashboardState } from "./use-dashboard-state";
import { makeDashboardStorage } from "./test-fixtures";

afterEach(cleanup);

describe("controlled dashboard editing", () => {
  it("updates controlled state and supports undo/redo without performing IO", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const original = makeDashboardStorage({ name: "Original" });
    const { result } = renderHook(() => {
      const [config, onChange] = useState(original);
      return useDashboardState({
        config,
        onChange,
        isLoaded: true,
        readOnly: false,
      });
    });
    act(() => result.current.setDashboardName("Edited"));
    expect(result.current.dashboardName).toBe("Edited");
    act(() => result.current.undo());
    expect(result.current.dashboardName).toBe("Original");
    act(() => result.current.redo());
    expect(result.current.dashboardName).toBe("Edited");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it.each([
    { isLoaded: false, readOnly: false },
    { isLoaded: true, readOnly: true },
  ])("denies writes when the host is not editable: %o", (permissions) => {
    const onChange = vi.fn();
    const config = makeDashboardStorage();
    const { result } = renderHook(() =>
      useDashboardState({ ...permissions, config, onChange }),
    );
    act(() => result.current.setDashboardName("Denied"));
    act(() => result.current.setFilters([]));
    expect(result.current.importDashboard(JSON.stringify(config)).success).toBe(
      false,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.canUndo()).toBe(false);
  });

  it("keeps histories and defaults isolated between mounted hosts", () => {
    const widget = {
      id: "w1",
      componentId: "card",
      layout: { i: "w1", x: 0, y: 0, w: 1, h: 1 },
      config: {},
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const { result } = renderHook(() => {
      const [first, setFirst] = useState(
        makeDashboardStorage({ widgets: [widget] }),
      );
      const [second, setSecond] = useState(
        makeDashboardStorage({ widgets: [widget] }),
      );
      return {
        first: useDashboardState(
          {
            config: first,
            onChange: setFirst,
            isLoaded: true,
            readOnly: false,
          },
          () => ({ defaultConfig: { title: "First" } }),
        ),
        second: useDashboardState(
          {
            config: second,
            onChange: setSecond,
            isLoaded: true,
            readOnly: false,
          },
          () => ({ defaultConfig: { title: "Second" } }),
        ),
      };
    });
    expect(result.current.first.widgets[0]?.config.title).toBe("First");
    expect(result.current.second.widgets[0]?.config.title).toBe("Second");
    act(() => result.current.first.setDashboardName("First edited"));
    expect(result.current.second.dashboardName).toBe("Test dashboard");
    expect(result.current.second.canUndo()).toBe(false);
  });
});

function useEditableDashboard() {
  const [config, onChange] = useState(makeDashboardStorage());
  return useDashboardState({
    config,
    onChange,
    isLoaded: true,
    readOnly: false,
  });
}

it("edits nested widget trees and duplicates independent configurations", () => {
  const { result } = renderHook(useEditableDashboard);
  const widget = {
    id: "root",
    componentId: "container",
    config: {},
    layout: { i: "root", x: 0, y: 0, w: 12, h: 6 },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  act(() => result.current.addWidget(widget));
  act(() =>
    result.current.addChildWidget("root", {
      ...widget,
      id: "nested",
      layout: { ...widget.layout, i: "nested" },
    }),
  );
  act(() =>
    result.current.addChildWidget("nested", {
      ...widget,
      id: "leaf",
      componentId: "card",
      layout: { ...widget.layout, i: "leaf", w: 2 },
    }),
  );
  act(() =>
    result.current.updateWidgetConfig("leaf", {
      title: "Nested title",
      nested: { value: 1 },
    }),
  );
  expect(result.current.findParent("leaf")?.id).toBe("nested");
  expect(result.current.findWidget("leaf")?.config.title).toBe("Nested title");
  act(() =>
    result.current.updateWidgetLayouts("nested", [
      { i: "leaf", x: 3, y: 2, w: 2, h: 1 },
    ]),
  );
  expect(result.current.findWidget("leaf")?.layout.x).toBe(3);
  act(() => result.current.duplicateWidget("leaf"));
  const children = result.current.findWidget("nested")?.children;
  expect(children).toHaveLength(2);
  expect(children?.[1]?.id).not.toBe("leaf");
  expect(children?.[1]?.config).toEqual(children?.[0]?.config);
  expect(children?.[1]?.config).not.toBe(children?.[0]?.config);
  act(() => result.current.deleteWidget("leaf"));
  expect(result.current.findWidget("leaf")).toBeUndefined();
  expect(result.current.findParent("missing")).toBeUndefined();
  expect(result.current.duplicateWidget("missing")).toBeNull();
  act(() => result.current.duplicateWidget("root"));
  expect(result.current.widgets).toHaveLength(2);
  act(() =>
    result.current.updateWidgetLayouts(null, [
      { i: "root", x: 0, y: 4, w: 12, h: 6 },
    ]),
  );
  expect(result.current.findWidget("root")?.layout.y).toBe(4);
  expect(result.current.findParent("root")).toBeNull();
});

it("round-trips planner definitions, filters and settings through JSON", () => {
  const { result } = renderHook(useEditableDashboard);
  act(() =>
    result.current.addPlannerRequest({
      variableName: "costs",
      pgrestFunctionName: "costs",
      pgrestHttpMethod: "POST",
      pgrestParams: [],
    }),
  );
  const id = result.current.getPlannerDefinitions()[0]!.id;
  act(() =>
    result.current.updatePlannerRequest(id, { variableName: "billing" }),
  );
  act(() =>
    result.current.setFilters([
      { key: "service", label: "Service", type: "text" },
    ]),
  );
  act(() => result.current.setRefreshInterval(60));
  act(() => result.current.setOrder(3));
  act(() => result.current.setAllowedGroups([" demo ", ""]));
  expect(result.current.allowedGroups).toEqual(["demo"]);
  const exported = result.current.exportDashboard();
  expect(JSON.parse(exported)).toMatchObject({
    requestPlanner: [{ id, variableName: "billing" }],
    order: 3,
    refreshInterval: 60,
    filters: [{ key: "service" }],
  });
  act(() => result.current.removePlannerRequest(id));
  expect(result.current.plannerDefinitions).toEqual([]);
  act(() => {
    expect(result.current.importDashboard(exported)).toEqual({ success: true });
  });
  expect(result.current.getPlannerDefinitions()[0]?.variableName).toBe(
    "billing",
  );
  expect(result.current.canUndo()).toBe(false);
  for (const invalid of [
    "not json",
    "null",
    "{}",
    '{"version":1,"widgets":[]}',
    '{"version":2,"widgets":{}}',
  ]) {
    act(() => {
      expect(result.current.importDashboard(invalid).success).toBe(false);
    });
  }
  expect(result.current.getPlannerDefinitions()[0]?.variableName).toBe(
    "billing",
  );
});
