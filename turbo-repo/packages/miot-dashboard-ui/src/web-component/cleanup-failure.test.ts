// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import { defineDashboardElement } from "./define-dashboard-element";
import { mountDashboard } from "../embed/mount-dashboard";
vi.mock("../embed/mount-dashboard", () => ({ mountDashboard: vi.fn() }));
afterEach(() => { document.body.replaceChildren(); vi.resetAllMocks(); });
const options = {
  instanceKey: "tenant/session/document",
  widgets: DEFAULT_STORAGE.widgets,
  unknownWidgetLabel: "Missing",
  registry: { get: () => undefined },
};
function prepare(name: string) {
  const destroy = vi.fn().mockImplementationOnce(() => { throw new Error("cleanup failed"); });
  const update = vi.fn();
  vi.mocked(mountDashboard).mockReturnValue({ update, destroy });
  const Element = defineDashboardElement(name);
  const element = new Element();
  document.body.append(element);
  element.dashboardOptions = options;
  return { element, update };
}
it("clears options and a destroyed handle after failed explicit cleanup", () => {
  const { element, update } = prepare("miot-cleanup-clear");
  expect(() => { element.dashboardOptions = undefined; }).toThrow("cleanup failed");
  expect(element.dashboardOptions).toBeUndefined();
  element.dashboardOptions = options;
  expect(mountDashboard).toHaveBeenCalledTimes(2);
  expect(update).not.toHaveBeenCalled();
});
it("reconnects with retained options after a disconnect cleanup failure", () => {
  const { element, update } = prepare("miot-cleanup-disconnect");
  // Invoke the browser lifecycle directly to observe the exception synchronously.
  const lifecycle = element as typeof element & { disconnectedCallback(): void; connectedCallback(): void };
  expect(() => lifecycle.disconnectedCallback()).toThrow("cleanup failed");
  expect(element.dashboardOptions).toBe(options);
  lifecycle.connectedCallback();
  expect(mountDashboard).toHaveBeenCalledTimes(2);
  expect(update).not.toHaveBeenCalled();
});
