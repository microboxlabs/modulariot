// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import {
  WidgetRenderer,
  type WidgetComponentProps,
  type WidgetFrameProps,
} from "./widget-renderer";

afterEach(cleanup);
const widget: Widget = {
  id: "parent",
  componentId: "container",
  config: {},
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
  layout: { i: "parent", x: 0, y: 0, w: 1, h: 1 },
  children: [
    {
      id: "child",
      componentId: "leaf",
      config: {},
      createdAt: "2026-09-29",
      updatedAt: "2026-09-29",
      layout: { i: "child", x: 0, y: 0, w: 1, h: 1 },
    },
  ],
};
function Fixture({
  widget,
  children,
  editMode,
  onDelete,
}: Readonly<WidgetComponentProps>) {
  return (
    <section aria-label={widget.id}>
      <span>{editMode ? "editing" : "viewing"}</span>
      {onDelete && <button onClick={onDelete}>Delete {widget.id}</button>}
      {children}
    </section>
  );
}
const registry = {
  get: (id: string) =>
    id === "missing"
      ? undefined
      : {
          meta: { hasChildren: id === "container", hasSettings: false },
          Component: Fixture,
        },
};
function ActionFrame({ onAction, children }: Readonly<WidgetFrameProps>) {
  return (
    <>
      <button onClick={() => onAction("settings")}>Settings</button>
      <button onClick={() => onAction("add")}>Add</button>
      {children}
    </>
  );
}
describe("portable widget renderer", () => {
  it("renders nested widgets read-only by default without exposing mutation callbacks", () => {
    const action = vi.fn();
    render(
      <WidgetRenderer
        widget={widget}
        registry={registry}
        onAction={action}
        unknownWidgetLabel="Unknown"
      />,
    );
    expect(screen.getAllByText("viewing")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
  it("gates host-frame actions by edit permission and widget metadata", () => {
    const action = vi.fn();
    const view = render(
      <WidgetRenderer
        widget={widget}
        registry={registry}
        onAction={action}
        Frame={ActionFrame}
        unknownWidgetLabel="Unknown"
      />,
    );
    fireEvent.click(screen.getAllByText("Add")[0]!);
    expect(action).not.toHaveBeenCalled();
    view.rerender(
      <WidgetRenderer
        widget={widget}
        registry={registry}
        onAction={action}
        Frame={ActionFrame}
        editMode
        unknownWidgetLabel="Unknown"
      />,
    );
    fireEvent.click(screen.getAllByText("Settings")[0]!);
    fireEvent.click(screen.getAllByText("Add")[1]!);
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText("Add")[0]!);
    expect(action).toHaveBeenLastCalledWith(widget, "add");
    fireEvent.click(screen.getByText("Delete child"));
    expect(action).toHaveBeenLastCalledWith(widget.children![0], "delete");
  });
  it("isolates DOM IDs between instances and supports localized unknown types", () => {
    const view = render(
      <>
        <WidgetRenderer
          widget={widget}
          registry={registry}
          unknownWidgetLabel="Desconocido"
        />
        <WidgetRenderer
          widget={widget}
          registry={registry}
          unknownWidgetLabel="Desconocido"
        />
        <WidgetRenderer
          widget={{ ...widget, componentId: "missing" }}
          registry={registry}
          unknownWidgetLabel="Desconocido"
        />
      </>,
    );
    const ids = [...view.container.querySelectorAll("[id]")].map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getByText("Desconocido (missing)")).toBeTruthy();
  });
});
