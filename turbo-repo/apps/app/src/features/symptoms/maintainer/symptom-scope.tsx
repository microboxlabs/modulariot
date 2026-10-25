"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isPlatformScope } from "@/features/common/platform-scope";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { CONTROL_TOWER_BASE } from "../control-tower/control-tower-api";

/**
 * Whose symptoms the editor works on: the active organization's, or, in the
 * platform scope, the platform's templates. Every request and SWR key of the
 * editor starts from `defs` or `sources`.
 */
export interface SymptomScope {
  kind: "org" | "platform";
  defs: string;
  sources: string;
  /** The catalog page, without the language prefix. */
  pages: string;
}

export const ORG_SYMPTOMS: SymptomScope = {
  kind: "org",
  defs: `${CONTROL_TOWER_BASE}/symptom-definitions`,
  sources: `${CONTROL_TOWER_BASE}/data-sources`,
  pages: "/users/settings/symptoms",
};

const TEMPLATES_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/platform/symptom-templates`;

export const PLATFORM_TEMPLATES: SymptomScope = {
  kind: "platform",
  defs: TEMPLATES_BASE,
  sources: `${TEMPLATES_BASE}/data-sources`,
  pages: "/users/settings/symptoms",
};

const ScopeContext = createContext<SymptomScope>(ORG_SYMPTOMS);

export const SymptomScopeProvider = ScopeContext.Provider;

/** Settings › Síntomas edits the platform's templates when the platform scope is active. */
export function ActiveSymptomScope({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { activeOrg } = useOrgScopes();
  // Until the scope is known (still loading, or the read failed), render nothing rather than the organization's screen.
  if (!activeOrg) return null;
  return (
    <ScopeContext.Provider
      value={
        isPlatformScope(activeOrg?.slug) ? PLATFORM_TEMPLATES : ORG_SYMPTOMS
      }
    >
      {children}
    </ScopeContext.Provider>
  );
}

export function useSymptomScope() {
  return useContext(ScopeContext);
}

/** Templates are always off and have no cases, stats or engine behind them. */
export function isTemplateScope(scope: SymptomScope) {
  return scope.kind === "platform";
}
