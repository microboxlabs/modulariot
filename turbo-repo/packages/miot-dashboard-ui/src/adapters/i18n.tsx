/**
 * Seam A — i18n.
 *
 * Hosts wire a `Translate` once at the root; package components read it via
 * `useDashboardI18n()`. Defaults to the identity translate (echoes keys), so
 * the package renders standalone. Bundled en/es dictionaries arrive with the
 * component migration (P4+).
 */

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { identityTranslate, type Translate } from "../types/i18n";

export interface DashboardI18nValue {
  t: Translate;
}

const DashboardI18nContext = createContext<DashboardI18nValue>({
  t: identityTranslate,
});

export interface DashboardI18nProviderProps {
  /** Host-supplied translate function; defaults to echoing the key. */
  translate?: Translate;
  children: ReactNode;
}

export function DashboardI18nProvider({
  translate,
  children,
}: DashboardI18nProviderProps) {
  const value = useMemo<DashboardI18nValue>(
    () => ({ t: translate ?? identityTranslate }),
    [translate]
  );
  return (
    <DashboardI18nContext.Provider value={value}>
      {children}
    </DashboardI18nContext.Provider>
  );
}

export function useDashboardI18n(): DashboardI18nValue {
  return useContext(DashboardI18nContext);
}
