// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { GridLayout } from "react-grid-layout";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { DashboardGrid } from "./dashboard-grid";

let grid: ComponentProps<typeof GridLayout>;
const observers: {
  callback: ResizeObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock("react-grid-layout", async (original) => {
  const actual = await original<typeof import("react-grid-layout")>();
  return {
    ...actual,
    GridLayout: (props: ComponentProps<typeof GridLayout>) => {
      grid = props;
      return (
        <div>
          {props.children}
          <button onClick={() => complete("drag")}>Drag</button>
          <button onClick={() => complete("resize")}>Resize</button>
        </div>
      );
    },
  };
});
function complete(kind: "drag" | "resize") {
  const handler = kind === "drag" ? grid.onDragStop : grid.onResizeStop;
  const layout = (grid.layout ?? []).map((item) => ({ ...item, x: 1, y: 2 }));
  handler?.(layout, null, null, null, new MouseEvent("mouseup"), null);
}
const widget: Widget = {
  id: "a",
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
  componentId: "text",
  config: {},
  layout: { i: "a", x: 30, y: 0, w: 30, h: 3, minW: 2, maxW: 40 },
};
const registry = {
  get: () => ({ getLayoutDefaults: () => ({ minW: 4, minH: 2 }) }),
};
const renderWidget = (item: Widget) => <span>{item.id}</span>;

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe() {}
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function resize(width: number) {
  act(() =>
    observers[0]?.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  );
}

describe("DashboardGrid", () => {
  it("fits the viewport without persisting or mutating stored positions", () => {
    const commit = vi.fn();
    render(
      <DashboardGrid
        widgets={[widget]}
        registry={registry}
        renderWidget={renderWidget}
        editMode
        onLayoutCommit={commit}
      />,
    );
    resize(600);
    expect(grid.layout?.[0]?.w).toBeLessThan(widget.layout.w);
    expect(grid.layout?.[0]?.x).toBe(0);
    expect(widget.layout.x).toBe(30);
    expect(commit).not.toHaveBeenCalled();
    resize(2400);
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByText("a")).toBeTruthy();
  });
  it("requires both edit intent and a commit handler", () => {
    const commit = vi.fn();
    const view = render(
      <DashboardGrid
        widgets={[widget]}
        registry={registry}
        renderWidget={renderWidget}
        onLayoutCommit={commit}
      />,
    );
    fireEvent.click(screen.getByText("Drag"));
    expect(grid.dragConfig?.enabled).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    view.rerender(
      <DashboardGrid
        widgets={[widget]}
        registry={registry}
        renderWidget={renderWidget}
        editMode
      />,
    );
    expect(grid.resizeConfig?.enabled).toBe(false);
  });
  it("commits user gestures preserving document constraints, and stops after revocation", () => {
    const commit = vi.fn();
    const view = render(
      <DashboardGrid
        widgets={[widget]}
        registry={registry}
        renderWidget={renderWidget}
        editMode
        onLayoutCommit={commit}
      />,
    );
    resize(600);
    fireEvent.click(screen.getByText("Drag"));
    fireEvent.click(screen.getByText("Resize"));
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[0]?.[0][0]).toMatchObject({
      i: "a",
      x: 1,
      y: 2,
      minW: 2,
      maxW: 40,
    });
    view.rerender(
      <DashboardGrid
        widgets={[widget]}
        registry={registry}
        renderWidget={renderWidget}
        onLayoutCommit={commit}
      />,
    );
    fireEvent.click(screen.getByText("Resize"));
    expect(commit).toHaveBeenCalledTimes(2);
  });
  it("disconnects observers and cancels deferred measurement on unmount", () => {
    const view = render(
      <DashboardGrid
        widgets={[]}
        registry={registry}
        renderWidget={renderWidget}
      />,
    );
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(
      observers.every((observer) => observer.disconnect.mock.calls.length > 0),
    ).toBe(true);
  });
});
