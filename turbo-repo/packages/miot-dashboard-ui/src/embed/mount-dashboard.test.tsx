// @vitest-environment jsdom
import { act, fireEvent, within, waitFor } from "@testing-library/react";
import { useState } from "react";
import { usePlannerData } from "@microboxlabs/miot-dashboard-ui/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  mountDashboard,
  type DashboardMount,
  type DashboardMountOptions,
} from "./mount-dashboard";
import type { WidgetComponentProps } from "../react/widget-renderer";
function Card({ onDelete }: Readonly<WidgetComponentProps>) {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>Count {count}</button>
      {onDelete && <button onClick={onDelete}>Delete</button>}
    </>
  );
}
const options: DashboardMountOptions = {
  instanceKey: "tenant/session/document",
  unknownWidgetLabel: "Missing",
  widgets: [
    {
      id: "a",
      componentId: "card",
      config: {},
      layout: { i: "a", x: 0, y: 0, w: 3, h: 2 },
      createdAt: "2026-09-29",
      updatedAt: "2026-09-29",
    },
  ],
  registry: {
    get: () => ({
      Component: Card,
      meta: { hasChildren: false, hasSettings: false },
      getLayoutDefaults: () => ({ minW: 1, minH: 1 }),
    }),
  },
};
const handles: DashboardMount[] = [];
function mount(next = options) {
  const element = document.createElement("div");
  document.body.append(element);
  let handle!: DashboardMount;
  act(() => {
    handle = mountDashboard(element, next);
  });
  handles.push(handle);
  return { element, handle };
}
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
  act(() => {
    handles.splice(0).forEach((handle) => handle.destroy());
  });
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
it("preserves same-instance state but resets it across tenant/session/document changes", () => {
  const { element, handle } = mount();
  const ui = within(element);
  fireEvent.click(ui.getByText("Count 0"));
  act(() => handle.update({ ...options, unknownWidgetLabel: "Unavailable" }));
  expect(ui.getByText("Count 1")).toBeTruthy();
  act(() =>
    handle.update({
      ...options,
      instanceKey: "another-tenant/session/document",
    }),
  );
  expect(ui.getByText("Count 0")).toBeTruthy();
});
it("replaces permissions and callbacks instead of retaining old values", () => {
  const onAction = vi.fn();
  const { element, handle } = mount({ ...options, editMode: true, onAction });
  const ui = within(element);
  fireEvent.click(ui.getByText("Delete"));
  expect(onAction).toHaveBeenCalledTimes(1);
  act(() => handle.update(options));
  expect(ui.queryByText("Delete")).toBeNull();
});
it("isolates roots, prevents duplicate mounts and releases containers on destroy", () => {
  const a = mount();
  const b = mount();
  fireEvent.click(within(a.element).getByText("Count 0"));
  expect(within(b.element).getByText("Count 0")).toBeTruthy();
  expect(() => mountDashboard(a.element, options)).toThrow(
    "occupied-container",
  );
  act(() => {
    a.handle.destroy();
    a.handle.destroy();
  });
  expect(a.element.childNodes).toHaveLength(0);
  expect(() => a.handle.update(options)).toThrow("destroyed");
  act(() => handles.push(mountDashboard(a.element, options)));
  expect(within(a.element).getByText("Count 0")).toBeTruthy();
});
it("rejects missing identity and nonempty host containers without changing them", () => {
  const element = document.createElement("div");
  element.textContent = "host content";
  expect(() => mountDashboard(element, options)).toThrow("occupied-container");
  expect(element.textContent).toBe("host content");
  expect(() =>
    mountDashboard(document.createElement("div"), {
      ...options,
      instanceKey: " ",
    }),
  ).toThrow("invalid-instance");
});

function QueryCard() {
  const result = usePlannerData("costs");
  return <output>{result.error ?? result.rows[0]?.cost ?? "Empty"}</output>;
}
it("shares saved queries with public React widgets and aborts on identity change and destroy", async () => {
  const signals: AbortSignal[] = [];
  const next: DashboardMountOptions = {
    ...options,
    registry: { get: () => ({ Component: QueryCard, meta: { hasChildren: false, hasSettings: false }, getLayoutDefaults: () => ({ minW: 1, minH: 1 }) }) },
    savedQueries: {
      client: { key: () => "costs", query: async (_slug, _id, _filters, signal) => { signals.push(signal); return [{ cost: 42 }]; } },
      slug: "costs", queries: [{ id: "q", variableName: "costs", connectionId: "c", operationId: "o", parameters: {} }],
      filters: {}, refreshIntervalMs: 0, paused: false, errorMessage: "Unavailable",
    },
  };
  const { element, handle } = mount(next);
  await waitFor(() => expect(within(element).getByText("42")).toBeTruthy());
  act(() => handle.update({ ...next, instanceKey: "replacement" }));
  expect(signals[0]?.aborted).toBe(true);
  expect(within(element).queryByText("42")).toBeNull();
  await waitFor(() => expect(within(element).getByText("42")).toBeTruthy());
  act(() => handle.destroy());
  expect(signals.at(-1)?.aborted).toBe(true);
});

it("preserves widget state when saved queries are enabled and disabled in the same instance", () => {
  const { element, handle } = mount();
  fireEvent.click(within(element).getByText("Count 0"));
  const query = vi.fn().mockResolvedValue([]);
  const withQueries: DashboardMountOptions = { ...options, savedQueries: {
    client: { key: () => "costs", query }, slug: "costs", queries: [], filters: {},
    refreshIntervalMs: 0, paused: true, errorMessage: "Unavailable",
  } };
  act(() => handle.update(withQueries));
  expect(within(element).getByText("Count 1")).toBeTruthy();
  act(() => handle.update(options));
  expect(within(element).getByText("Count 1")).toBeTruthy();
  expect(query).not.toHaveBeenCalled();
});
