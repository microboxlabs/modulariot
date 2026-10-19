import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { Widget } from "../../types/dashboard.types";
import type { DashletComponentProps } from "../../dashlets/types";
import { WidgetRenderer } from "./widget-renderer";

vi.mock("../../context/dashboard-context", () => ({
  useDashboard: () => host,
}));
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("../delete-widget-modal", () => ({
  DeleteWidgetModal: ({
    onConfirm,
    onClose,
  }: {
    onConfirm: () => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="delete">
      <button onClick={onConfirm}>Confirm delete</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}));
vi.mock("../add-widget-modal/add-widget-modal", () => ({
  AddWidgetModal: ({ parentId }: { parentId: string }) => (
    <div role="dialog" aria-label="add">
      {parentId}
    </div>
  ),
}));

function Fixture({ widget, children }: Readonly<DashletComponentProps>) {
  return <section aria-label={widget.id}>{children}</section>;
}
function Settings({
  config,
  onSave,
}: Readonly<{
  config: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
}>) {
  return (
    <div role="dialog" aria-label="settings">
      <span>{String(config.name)}</span>
      <button onClick={() => onSave({ name: "saved" })}>Save</button>
    </div>
  );
}
const child: Widget = {
  id: "child",
  componentId: "leaf",
  config: { name: "initial" },
  layout: { i: "child", x: 0, y: 0, w: 1, h: 1 },
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
};
const parent: Widget = {
  ...child,
  id: "parent",
  componentId: "container",
  children: [child],
};
let currentChild: Widget | undefined;
const host = {
  editMode: true,
  dictionary: {},
  updateWidgetConfig: vi.fn(),
  deleteWidget: vi.fn(),
  duplicateWidget: vi.fn(),
  findWidget: (id: string) => (id === "parent" ? parent : currentChild),
  registry: {
    get: (id: string) => ({
      meta: {
        id,
        name: id,
        hasChildren: id === "container",
        hasSettings: true,
      },
      Component: Fixture,
      SettingsModal: Settings,
    }),
  },
};
beforeEach(() => {
  host.editMode = true;
  currentChild = child;
  vi.clearAllMocks();
});
afterEach(cleanup);
function childFrame() {
  return screen.getByRole("region", { name: "child" }).parentElement!;
}

describe("app widget renderer adapter", () => {
  it("targets nested settings and reads the latest widget config", () => {
    const view = render(<WidgetRenderer widget={parent} />);
    fireEvent.click(within(childFrame()).getByTitle("Settings"));
    expect(screen.getByRole("dialog", { name: "settings" })).toHaveTextContent(
      "initial"
    );
    currentChild = { ...child, config: { name: "new value" } };
    view.rerender(
      <WidgetRenderer widget={{ ...parent, children: [currentChild] }} />
    );
    expect(screen.getByRole("dialog", { name: "settings" })).toHaveTextContent(
      "new value"
    );
    fireEvent.click(screen.getByText("Save"));
    expect(host.updateWidgetConfig).toHaveBeenCalledWith("child", {
      name: "saved",
    });
  });
  it("confirms nested deletes and dispatches duplicate actions without deleting the parent", () => {
    render(<WidgetRenderer widget={parent} />);
    fireEvent.click(
      within(childFrame()).getByTitle("dashboard.settings.duplicate")
    );
    expect(host.duplicateWidget).toHaveBeenCalledWith("child");
    fireEvent.click(within(childFrame()).getByTitle("Delete"));
    expect(host.deleteWidget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirm delete"));
    expect(host.deleteWidget).toHaveBeenCalledWith("child");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("hides dialogs when editing is revoked or the target no longer exists", () => {
    const view = render(<WidgetRenderer widget={parent} />);
    fireEvent.click(within(childFrame()).getByTitle("Settings"));
    host.editMode = false;
    view.rerender(<WidgetRenderer widget={parent} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    host.editMode = true;
    view.rerender(<WidgetRenderer widget={parent} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(childFrame()).getByTitle("Settings"));
    currentChild = undefined;
    view.rerender(<WidgetRenderer widget={{ ...parent, children: [] }} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(host.updateWidgetConfig).not.toHaveBeenCalled();
  });
  it("keeps the app anchor convention and targets the selected container for additions", () => {
    const view = render(<WidgetRenderer widget={parent} />);
    expect(view.container.querySelector("#widget-parent")).toBeTruthy();
    expect(view.container.querySelector("#widget-child")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Add widget"));
    expect(screen.getByRole("dialog", { name: "add" })).toHaveTextContent(
      "parent"
    );
  });
});
