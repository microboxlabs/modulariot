// @vitest-environment jsdom
import { act, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  defineDashboardElement,
  type DashboardElement,
} from "./define-dashboard-element";
import type { DashboardMountOptions } from "../embed/mount-dashboard";
function Card() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
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
  act(() => document.body.replaceChildren());
  vi.unstubAllGlobals();
});
it("mounts from a property, updates, clears, and remounts on reconnect", () => {
  const Element = defineDashboardElement("miot-test-lifecycle");
  const element = new Element();
  element.dashboardOptions = options;
  act(() => document.body.append(element));
  const ui = within(element);
  fireEvent.click(ui.getByText("Count 0"));
  act(() => {
    element.dashboardOptions = {
      ...options,
      unknownWidgetLabel: "Unavailable",
    };
  });
  expect(ui.getByText("Count 1")).toBeTruthy();
  act(() => element.remove());
  expect(element.childNodes).toHaveLength(0);
  act(() => document.body.append(element));
  expect(ui.getByText("Count 0")).toBeTruthy();
  act(() => {
    element.dashboardOptions = undefined;
  });
  expect(element.childNodes).toHaveLength(0);
  act(() => {
    element.dashboardOptions = options;
  });
  expect(ui.getByText("Count 0")).toBeTruthy();
});
it("upgrades an options property set before registration", () => {
  const element = document.createElement(
    "miot-test-upgrade",
  ) as DashboardElement;
  element.dashboardOptions = options;
  document.body.append(element);
  act(() => {
    defineDashboardElement("miot-test-upgrade");
  });
  expect(within(element).getByText("Count 0")).toBeTruthy();
  act(() => {
    element.dashboardOptions = { ...options, instanceKey: "new-session" };
  });
  expect(Object.hasOwn(element, "dashboardOptions")).toBe(false);
});
it("registers idempotently but refuses another implementation's name", () => {
  const Element = defineDashboardElement("miot-test-repeat");
  expect(defineDashboardElement("miot-test-repeat")).toBe(Element);
  customElements.define("miot-test-foreign", class extends HTMLElement {});
  expect(() => defineDashboardElement("miot-test-foreign")).toThrow(
    "already registered",
  );
});
it("waits for configuration and isolates two elements", () => {
  const Element = defineDashboardElement("miot-test-two");
  const a = new Element();
  const b = new Element();
  act(() => {
    document.body.append(a, b);
  });
  expect(a.childNodes).toHaveLength(0);
  act(() => {
    a.dashboardOptions = options;
    b.dashboardOptions = options;
  });
  fireEvent.click(within(a).getByText("Count 0"));
  expect(within(b).getByText("Count 0")).toBeTruthy();
  act(() => {
    a.dashboardOptions = { ...options, instanceKey: "another-tenant" };
  });
  expect(within(a).getByText("Count 0")).toBeTruthy();
});
