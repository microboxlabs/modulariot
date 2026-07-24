/**
 * Seam E — persistence.
 *
 * The package persists dashboard configs through an injected `DashboardStore`;
 * it never knows what's behind it (Alfresco today, the host backend after the
 * migration). Debounce/retry/keepalive-flush behavior stays package-side in
 * the storage hook (P2); the store is the raw transport.
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { DashboardStorageSchema } from "../types/dashboard";

/**
 * Host-defined addressing for a stored dashboard. `scopeId` is the host's
 * container concept (an Alfresco site, a tenant, a folder…); `slug` is the
 * dashboard identifier within it.
 */
export interface DashboardRef {
  scopeId: string;
  slug: string;
}

/** Summary row for listings (sidebar, landing page). */
export interface DashboardSummary {
  slug: string;
  name: string;
}

export interface DashboardStore {
  /** Load a dashboard config; null when it doesn't exist. */
  load(ref: DashboardRef): Promise<DashboardStorageSchema | null>;
  /** Persist a full config (create or replace). */
  save(ref: DashboardRef, config: DashboardStorageSchema): Promise<void>;
  /** List dashboards in a scope. */
  list(scopeId: string): Promise<DashboardSummary[]>;
  /** Delete a dashboard. */
  remove(ref: DashboardRef): Promise<void>;
  /**
   * Optional fire-and-forget save for page teardown (e.g. fetch with
   * `keepalive: true` or `navigator.sendBeacon`). Used by the debounced
   * saver to flush a pending save on unmount; falls back to best-effort
   * `save()` when absent.
   */
  saveBeacon?(ref: DashboardRef, config: DashboardStorageSchema): void;
}

const StoreContext = createContext<DashboardStore | null>(null);

export interface DashboardStoreProviderProps {
  store: DashboardStore;
  children: ReactNode;
}

export function DashboardStoreProvider({
  store,
  children,
}: DashboardStoreProviderProps) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Required seam: throws with wiring guidance when absent. */
export function useDashboardStore(): DashboardStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error(
      "useDashboardStore: no DashboardStore wired — wrap the dashboard in <DashboardStoreProvider> (or <MiotDashboardProvider store={...}>)"
    );
  }
  return store;
}
