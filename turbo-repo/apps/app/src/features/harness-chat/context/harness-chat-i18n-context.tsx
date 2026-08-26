"use client";

import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { tr } from "@/features/i18n/tr.service";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import type { TrKey } from "@/features/i18n/tr.types";

export type TrFn = (path: TrKey, params?: Record<string, string>) => string;

const HarnessChatI18nContext = createContext<TrFn | null>(null);

/**
 * Makes the app's dictionary reachable, as a type-checked `tr()` call, from
 * anywhere under `HarnessChat` — including the ask_user_question/show_dashlet
 * extension cards, which render several layers deep through assistant-ui's
 * own tool-call machinery and have no prop path back up to `HarnessChat`
 * itself. `dict` is the plain JSON object `getDictionary()` returns (safe to
 * pass from a server component into this client tree); `tr()` itself has no
 * "server-only" restriction, just the dictionary lookup does.
 */
export function HarnessChatI18nProvider({
  dict,
  children,
}: PropsWithChildren<{ dict: I18nDictionary }>) {
  // Same exemption reasoning as src/features/i18n/i18n.service.ts's own
  // `_tr`: `path` below is already TrKey-typed (see TrFn above), just
  // forwarded to the real tr() one level down — not a runtime-built key.
  const trFn = useMemo<TrFn>(
    // eslint-disable-next-line no-restricted-syntax
    () => (path, params) => tr(path, dict, params),
    [dict],
  );
  return (
    <HarnessChatI18nContext.Provider value={trFn}>{children}</HarnessChatI18nContext.Provider>
  );
}

export function useHarnessChatTr(): TrFn {
  const trFn = useContext(HarnessChatI18nContext);
  if (!trFn) {
    throw new Error("useHarnessChatTr must be used within HarnessChatI18nProvider");
  }
  return trFn;
}
