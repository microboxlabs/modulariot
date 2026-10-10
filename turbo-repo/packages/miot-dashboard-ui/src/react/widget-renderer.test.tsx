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
  onAddChild,
}: Readonly<WidgetComponentProps>) {
  return (
    <section aria-label={widget.id}>
      <span>{editMode ? "editing" : "viewing"}</span>
      {onDelete && <button onClick={onDelete}>Delete {widget.id}</button>}
      {onAddChild && (
        <button onClick={() => onAddChild("info_card")}>Add typed child</button>
      )}
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
    fireEvent.click(screen.getByText("Add typed child"));
    expect(action).toHaveBeenLastCalledWith(widget, "add", "info_card");
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

  it("marks leaf content for the grid's edit mode, outside frames and containers", () => {
    for (const editMode of [false, true]) {
      const { container, unmount } = render(
        <WidgetRenderer
          widget={widget}
          registry={registry}
          editMode={editMode}
          onAction={vi.fn()}
          Frame={ActionFrame}
          unknownWidgetLabel="Unknown"
        />,
      );
      const classes = (id: string) => [
        ...(screen.getByRole("region", { name: id }).parentElement?.classList ??
          []),
      ];
      expect(classes("child")).toEqual([
        "miot-widget__content",
        "miot-widget__content--leaf",
      ]);
      expect(classes("parent")).toEqual(["miot-widget__content"]);
      expect(
        container.querySelectorAll(".miot-widget__content--leaf button"),
      ).toHaveLength(editMode ? 1 : 0);
      for (const button of screen.queryAllByRole("button", {
        name: "Settings",
      })) {
        expect(button.closest(".miot-widget__content--leaf")).toBeNull();
      }
      unmount();
    }
  });
});
