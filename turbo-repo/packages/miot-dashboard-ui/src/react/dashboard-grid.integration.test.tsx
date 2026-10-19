// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { DashboardGrid } from "./dashboard-grid";

const widget: Widget = {
  id: "costs",
  componentId: "text",
  config: {},
  layout: { i: "costs", x: 0, y: 0, w: 6, h: 3 },
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
};
const registry = {
  get: () => ({ getLayoutDefaults: () => ({ minW: 1, minH: 1 }) }),
};
const renderWidget = () => <span>Costs</span>;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
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

it("real grid commits a drag only on release and prevents viewer gestures", () => {
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
  const card = screen.getByText("Costs");
  // jsdom has no layout engine; supply the positioned parent used by drag math.
  const cell = card.closest(".react-grid-item")!;
  Object.defineProperty(cell, "offsetParent", { value: cell.parentElement });
  fireEvent.mouseDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseMove(document, { clientX: 110, clientY: 10 });
  expect(commit).not.toHaveBeenCalled();
  fireEvent.mouseUp(document, { clientX: 110, clientY: 10 });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0]?.[0][0].x).toBeGreaterThan(0);
  view.rerender(
    <DashboardGrid
      widgets={[widget]}
      registry={registry}
      renderWidget={renderWidget}
      onLayoutCommit={commit}
    />,
  );
  fireEvent.mouseDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseMove(document, { clientX: 210, clientY: 10 });
  fireEvent.mouseUp(document, { clientX: 210, clientY: 10 });
  expect(commit).toHaveBeenCalledTimes(1);
});

it("real grid commits resize only on release", () => {
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
  const handle = view.container.querySelector(".react-resizable-handle");
  expect(handle).not.toBeNull();
  fireEvent.mouseDown(handle!, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.mouseMove(document, { clientX: 500, clientY: 250 });
  expect(commit).not.toHaveBeenCalled();
  fireEvent.mouseUp(document, { clientX: 500, clientY: 250 });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0]?.[0][0].w).toBeGreaterThan(widget.layout.w);
});
