// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { DashboardCanvas } from "./dashboard-canvas";
import type { WidgetComponentProps } from "./widget-renderer";
function Card({ widget, children, onDelete }: Readonly<WidgetComponentProps>) {
  return (
    <div>
      {widget.id}
      {onDelete && <button onClick={onDelete}>Delete</button>}
      {children}
    </div>
  );
}
const registry = {
  get: (id: string) =>
    id === "card"
      ? {
          Component: Card,
          meta: { hasChildren: true, hasSettings: true },
          getLayoutDefaults: () => ({ minW: 1, minH: 1 }),
        }
      : undefined,
};
const leaf: Widget = {
  id: "leaf",
  componentId: "card",
  config: {},
  layout: { i: "leaf", x: 0, y: 0, w: 3, h: 2 },
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
};
const root: Widget = {
  ...leaf,
  id: "root",
  layout: { ...leaf.layout, i: "root" },
  children: [leaf],
};
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
it("renders nested widgets and requires explicit edit intent", () => {
  const action = vi.fn();
  const view = render(
    <DashboardCanvas
      widgets={[root]}
      registry={registry}
      unknownWidgetLabel="Missing widget"
      onAction={action}
    />,
  );
  expect(screen.getByText("root")).toBeTruthy();
  expect(screen.getByText("leaf")).toBeTruthy();
  expect(screen.queryByText("Delete")).toBeNull();
  view.rerender(
    <DashboardCanvas
      widgets={[root]}
      registry={registry}
      unknownWidgetLabel="Missing widget"
      onAction={action}
      editMode
    />,
  );
  fireEvent.click(screen.getAllByText("Delete")[0]!);
  expect(action).toHaveBeenCalledWith(root, "delete");
  view.rerender(
    <DashboardCanvas
      widgets={[root]}
      registry={registry}
      unknownWidgetLabel="Missing widget"
      onAction={action}
    />,
  );
  expect(screen.queryByText("Delete")).toBeNull();
});
it("isolates IDs and actions for repeated widget IDs across canvases", () => {
  const first = vi.fn();
  const second = vi.fn();
  const view = render(
    <>
      <section aria-label="First">
        <DashboardCanvas
          widgets={[leaf]}
          registry={registry}
          unknownWidgetLabel="Missing"
          editMode
          onAction={first}
        />
      </section>
      <section aria-label="Second">
        <DashboardCanvas
          widgets={[leaf]}
          registry={registry}
          unknownWidgetLabel="Missing"
          editMode
          onAction={second}
        />
      </section>
    </>,
  );
  const ids = [...view.container.querySelectorAll(".miot-widget")].map(
    (node) => node.id,
  );
  expect(new Set(ids).size).toBe(2);
  fireEvent.click(
    within(screen.getByRole("region", { name: "Second" })).getByText("Delete"),
  );
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith(leaf, "delete");
});
it("uses the host fallback for missing plugins", () => {
  render(
    <DashboardCanvas
      widgets={[{ ...leaf, componentId: "external" }]}
      registry={registry}
      unknownWidgetLabel="Unavailable plugin"
    />,
  );
  expect(screen.getByText("Unavailable plugin (external)")).toBeTruthy();
});
