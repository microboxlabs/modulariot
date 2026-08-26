"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const StandaloneDictionaryContext = createContext<I18nRecord | null>(null);

/**
 * Carries the locale dictionary to dashlets rendered *outside* a
 * `DashboardProvider` — harness-chat's `show_dashlet` cards and the
 * /dev/components gallery.
 *
 * Without it those dashlets fall back to `DASHBOARD_FALLBACK.dictionary`,
 * an empty object, and `tr()`/`trDynamic()` return the raw key path, so the
 * UI renders literal strings like "dashboard.settings.totalItems" (see the
 * `showRowCount` note in dashlet-preview.tsx, which routes around exactly
 * that for one dashlet) — or falls back to hard-coded Spanish, as
 * ConditionIcon does, regardless of the active locale.
 *
 * Deliberately its own tiny context rather than a prop on every dashlet:
 * dashlets reach their dictionary through `useOptionalDashboard()`, several
 * layers below any call site that knows the locale.
 */
export function StandaloneDictionaryProvider({
  dictionary,
  children,
}: PropsWithChildren<{ dictionary: I18nRecord }>) {
  return (
    <StandaloneDictionaryContext.Provider value={dictionary}>
      {children}
    </StandaloneDictionaryContext.Provider>
  );
}

/** The standalone dictionary, or null when no provider is above — in which
 * case the empty fallback still applies, same as before. */
export function useStandaloneDictionary(): I18nRecord | null {
  return useContext(StandaloneDictionaryContext);
}
