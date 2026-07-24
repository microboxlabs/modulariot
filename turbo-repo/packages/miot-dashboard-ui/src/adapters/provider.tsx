/**
 * Root provider composing all six adapter seams (A–F).
 *
 * Optional seams default sensibly (identity translate, window.history URL
 * adapter, console notify, full capabilities). `store` and `dataSources` have
 * no meaningful default — the corresponding hooks throw with wiring guidance
 * if a component needs them and they weren't provided.
 */

import type { ReactNode } from "react";
import type { Translate } from "../types/i18n";
import { DashboardI18nProvider } from "./i18n";
import {
  DashboardUrlStateProvider,
  type UrlStateAdapter,
  type LinkComponent,
} from "./url-state";
import { DashboardNotificationsProvider, type NotifyFn } from "./notifications";
import {
  DashboardDataSourcesProvider,
  type DataSourceProvider,
} from "./datasource";
import { DashboardStoreProvider, type DashboardStore } from "./store";
import {
  DashboardCapabilitiesProvider,
  type DashboardCapabilities,
} from "./capabilities";

export interface MiotDashboardProviderProps {
  /** Seam A — i18n (default: echo keys). */
  translate?: Translate;
  /** Seam B — URL state (default: window.history adapter). */
  urlState?: UrlStateAdapter;
  /** Seam B — link component (default: plain anchor). */
  Link?: LinkComponent;
  /** Seam C — notifications (default: console). */
  notify?: NotifyFn;
  /** Seam D — datasources (no default; required by data-driven dashlets). */
  dataSources?: DataSourceProvider;
  /** Seam E — persistence (no default; required to load/save dashboards). */
  store?: DashboardStore;
  /** Seam F — capabilities (default: full access). */
  capabilities?: DashboardCapabilities;
  children: ReactNode;
}

export function MiotDashboardProvider({
  translate,
  urlState,
  Link,
  notify,
  dataSources,
  store,
  capabilities,
  children,
}: MiotDashboardProviderProps) {
  let tree = children;
  if (dataSources) {
    tree = (
      <DashboardDataSourcesProvider provider={dataSources}>
        {tree}
      </DashboardDataSourcesProvider>
    );
  }
  if (store) {
    tree = <DashboardStoreProvider store={store}>{tree}</DashboardStoreProvider>;
  }
  return (
    <DashboardI18nProvider translate={translate}>
      <DashboardUrlStateProvider adapter={urlState} Link={Link}>
        <DashboardNotificationsProvider notify={notify}>
          <DashboardCapabilitiesProvider capabilities={capabilities}>
            {tree}
          </DashboardCapabilitiesProvider>
        </DashboardNotificationsProvider>
      </DashboardUrlStateProvider>
    </DashboardI18nProvider>
  );
}
