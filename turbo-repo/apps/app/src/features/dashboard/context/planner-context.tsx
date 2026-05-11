"use client";

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { PlannerRequestDefinition } from "../types/dashboard.types";
import { useDashboard } from "./dashboard-context";
import { useDashboardFilters } from "./dashboard-filters-context";
import { buildPgrestFetch, parseRows } from "../dashlets/common/pgrest-utils";
import { resolveFilterParams } from "../dashlets/common/resolve-filter-params";
import { usePollingInterval } from "../hooks/use-polling-interval";

// ============================================================================
// Types
// ============================================================================

export interface PlannerQueryResult {
  rows: Record<string, string>[];
  loading: boolean;
  error: string | null;
}

interface PlannerContextValue {
  results: Map<string, PlannerQueryResult>;
  definitions: PlannerRequestDefinition[];
  /** Column keys per variable name, derived from the first row of results */
  schemas: Map<string, string[]>;
}

const EMPTY_RESULT: PlannerQueryResult = { rows: [], loading: false, error: null };

// ============================================================================
// Context
// ============================================================================

const PlannerContext = createContext<PlannerContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function PlannerProvider({ children }: Readonly<PropsWithChildren>) {
  const { plannerDefinitions, updatePlannerRequest, refreshInterval: dashboardRefreshInterval, editMode } = useDashboard();
  const { activeFilters } = useDashboardFilters();
  const [results, setResults] = useState<Map<string, PlannerQueryResult>>(
    () => new Map()
  );

  // Persist schema into the definition when it changes after a successful fetch
  const persistSchema = useCallback(
    (defId: string, newSchema: string[], currentSchema?: string[]) => {
      const same =
        currentSchema?.length === newSchema.length &&
        currentSchema?.every((k, i) => k === newSchema[i]);
      if (!same) {
        updatePlannerRequest(defId, { schema: newSchema });
      }
    },
    [updatePlannerRequest],
  );

  // Serialize definitions to detect config changes (exclude schema to avoid loops)
  const definitionsKey = useMemo(
    () =>
      JSON.stringify([
        plannerDefinitions.map(({ schema: _s, ...rest }) => rest),
        activeFilters,
      ]),
    [plannerDefinitions, activeFilters],
  );

  // Abort controller for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // Keep latest deps in a ref so the fetch callback reads fresh values
  const depsRef = useRef({ plannerDefinitions, activeFilters, persistSchema });
  depsRef.current = { plannerDefinitions, activeFilters, persistSchema };

  const doFetchAll = useCallback((silent: boolean) => {
    const { plannerDefinitions: defs, activeFilters: filters, persistSchema: persist } = depsRef.current;

    if (defs.length === 0) {
      setResults((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }

    // Cancel any in-flight requests
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setResults((prev) => {
        const next = new Map(prev);
        for (const def of defs) {
          next.set(def.variableName, {
            rows: next.get(def.variableName)?.rows ?? [],
            loading: true,
            error: null,
          });
        }
        return next;
      });
    }

    const run = async () => {
      const entries: [string, PlannerQueryResult][] = await Promise.all(
        defs.map(async (def): Promise<[string, PlannerQueryResult]> => {
          try {
            if (!def.pgrestFunctionName) {
              return [def.variableName, { rows: [], loading: false, error: null }];
            }
            const resolvedParams = resolveFilterParams(def.pgrestParams, filters);
            const { url, init } = buildPgrestFetch(
              def.pgrestFunctionName,
              def.pgrestHttpMethod,
              resolvedParams,
              def.dataSourceId,
            );
            const res = await fetch(url, { ...init, signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: unknown = await res.json();
            const rows = parseRows(data, { singleObjectFallback: true });

            if (rows.length > 0) {
              persist(def.id, Object.keys(rows[0]), def.schema);
            }

            return [def.variableName, { rows, loading: false, error: null }];
          } catch (err) {
            if (controller.signal.aborted) {
              return [def.variableName, { rows: [], loading: false, error: null }];
            }
            return [
              def.variableName,
              {
                rows: [],
                loading: false,
                error: err instanceof Error ? err.message : "Failed to fetch",
              },
            ];
          }
        })
      );

      if (!controller.signal.aborted) {
        setResults(new Map(entries));
      }
    };

    void run();
  }, []);

  // Initial + dependency-driven fetch (shows loading state).
  // Debounced so rapid keystrokes in planner inputs don't spam API calls.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      doFetchAll(false);
      return () => { abortRef.current?.abort(); };
    }

    debounceRef.current = setTimeout(() => doFetchAll(false), 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definitionsKey]);

  // Polling (silent — no loading state flash)
  const pollingIntervalMs =
    editMode || !dashboardRefreshInterval || plannerDefinitions.length === 0
      ? 0
      : dashboardRefreshInterval * 1000;
  const pollCallback = useCallback(() => doFetchAll(true), [doFetchAll]);
  usePollingInterval(pollCallback, pollingIntervalMs);

  // Derive column schemas from the first row of each result,
  // falling back to the persisted schema stored in the definition.
  const schemas = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const def of plannerDefinitions) {
      const result = results.get(def.variableName);
      if (result && result.rows.length > 0) {
        map.set(def.variableName, Object.keys(result.rows[0]));
      } else if (def.schema?.length) {
        map.set(def.variableName, def.schema);
      }
    }
    return map;
  }, [results, plannerDefinitions]);

  const value = useMemo<PlannerContextValue>(
    () => ({ results, definitions: plannerDefinitions, schemas }),
    [results, plannerDefinitions, schemas]
  );

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePlannerContext(): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error(
      "usePlannerContext must be used within a PlannerProvider"
    );
  }
  return context;
}

const FALLBACK: PlannerContextValue = {
  results: new Map(),
  definitions: [],
  schemas: new Map(),
};

/**
 * Like `usePlannerContext` but returns a fallback value instead of throwing
 * when rendered outside a `PlannerProvider` (e.g. in the geographic-view).
 */
export function useOptionalPlannerContext(): PlannerContextValue {
  return useContext(PlannerContext) ?? FALLBACK;
}

export { EMPTY_RESULT };
