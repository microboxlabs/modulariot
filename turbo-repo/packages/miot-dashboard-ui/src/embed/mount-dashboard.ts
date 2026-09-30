import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  DashboardCanvas,
  SavedQueryProvider,
  type SavedQueryOptions,
  type DashboardCanvasProps,
} from "@microboxlabs/miot-dashboard-ui/react";

export interface DashboardMountOptions extends DashboardCanvasProps {
  /** Change for a new tenant, session or document to discard component-local state. */
  instanceKey: string;
  /** Optional saved-query execution for native hosts. Identity follows instanceKey. */
  savedQueries?: Omit<SavedQueryOptions, "sessionKey">;
}
export interface DashboardMount {
  /** Replace all options. Omitted callbacks and edit intent are revoked. */
  update(options: DashboardMountOptions): void;
  /** Unmount and release the container. Safe to call repeatedly. */
  destroy(): void;
}
export class DashboardMountError extends Error {
  constructor(
    public readonly code:
      | "invalid-instance"
      | "occupied-container"
      | "destroyed",
  ) {
    super(`Dashboard mount: ${code}`);
    this.name = "DashboardMountError";
  }
}
function MountedDashboard({ instanceKey, savedQueries, ...canvas }: Readonly<DashboardMountOptions>) {
  const content = createElement(DashboardCanvas, canvas);
  return savedQueries
    ? createElement(SavedQueryProvider, { ...savedQueries, sessionKey: instanceKey }, content)
    : content;
}

const mounts = new WeakSet<HTMLElement>();
function validateOptions(options: DashboardMountOptions) {
  if (typeof options.instanceKey !== "string" || !options.instanceKey.trim()) {
    throw new DashboardMountError("invalid-instance");
  }
}

/** Mount in an empty, host-owned element. Hosts must call destroy before removing it. */
export function mountDashboard(
  element: HTMLElement,
  options: DashboardMountOptions,
): DashboardMount {
  validateOptions(options);
  if (mounts.has(element) || element.hasChildNodes()) {
    throw new DashboardMountError("occupied-container");
  }
  const root = createRoot(element);
  mounts.add(element);
  let destroyed = false;
  const update = (next: DashboardMountOptions) => {
    if (destroyed) throw new DashboardMountError("destroyed");
    validateOptions(next);
    root.render(createElement(MountedDashboard, { ...next, key: next.instanceKey }));
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    try {
      root.unmount();
    } finally {
      mounts.delete(element);
    }
  };
  try {
    update(options);
  } catch (error) {
    destroy();
    throw error;
  }
  return { update, destroy };
}
