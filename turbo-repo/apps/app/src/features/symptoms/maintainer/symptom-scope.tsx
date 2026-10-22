"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CONTROL_TOWER_BASE } from "../control-tower/control-tower-api";

/**
 * Whose symptoms the editor works on: the active organization's, or the
 * platform's templates (symptoms of the reserved `platform` tenant). Every
 * request and SWR key of the editor starts from `defs` or `sources`.
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
  pages: "/users/settings/platform/symptom-templates",
};

const ScopeContext = createContext<SymptomScope>(ORG_SYMPTOMS);

export const SymptomScopeProvider = ScopeContext.Provider;

/** The symptom editor working on the platform's templates; for server pages. */
export function PlatformTemplatesScope({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ScopeContext.Provider value={PLATFORM_TEMPLATES}>
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
