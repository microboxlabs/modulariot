import {
  mountDashboard,
  type DashboardMount,
  type DashboardMountOptions,
} from "../embed/mount-dashboard";

export interface DashboardElement extends HTMLElement {
  /** Full replacement; set undefined to clear the dashboard and release its state. */
  dashboardOptions: DashboardMountOptions | undefined;
}
export interface DashboardElementConstructor {
  new (): DashboardElement;
}
export class DashboardElementRegistrationError extends Error {
  constructor() {
    super(
      "Dashboard element name is already registered by another implementation",
    );
    this.name = "DashboardElementRegistrationError";
  }
}
const definitions = new Map<string, DashboardElementConstructor>();

/** Explicit browser-only registration; importing this entry does not register an element. */
export function defineDashboardElement(
  name = "miot-dashboard",
): DashboardElementConstructor {
  const existing = customElements.get(name);
  if (existing) {
    const owned = definitions.get(name);
    if (existing === owned) return owned;
    throw new DashboardElementRegistrationError();
  }
  class Element extends HTMLElement implements DashboardElement {
    #options: DashboardMountOptions | undefined;
    #mount: DashboardMount | undefined;
    get dashboardOptions() {
      return this.#options;
    }
    set dashboardOptions(next: DashboardMountOptions | undefined) {
      if (next === undefined) {
        this.#mount?.destroy();
        this.#mount = undefined;
      } else if (this.isConnected) {
        if (this.#mount) this.#mount.update(next);
        else this.#mount = mountDashboard(this, next);
      }
      this.#options = next;
    }
    connectedCallback() {
      this.classList.add("miot-dashboard-element");
      // Properties assigned before customElements.define must reach the accessor.
      if (Object.hasOwn(this, "dashboardOptions")) {
        const pending = this.dashboardOptions;
        Reflect.deleteProperty(this, "dashboardOptions");
        this.dashboardOptions = pending;
      } else if (this.#options && !this.#mount) {
        this.#mount = mountDashboard(this, this.#options);
      }
    }
    disconnectedCallback() {
      this.#mount?.destroy();
      this.#mount = undefined;
    }
  }
  customElements.define(name, Element);
  definitions.set(name, Element);
  return Element;
}
