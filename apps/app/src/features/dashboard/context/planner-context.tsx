"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { PlannerRequestDefinition } from "../types/dashboard.types";
import { useDashboard } from "./dashboard-context";
import { buildPgrestFetch, parseRows } from "../dashlets/common/pgrest-utils";

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
  const { plannerDefinitions, updatePlannerRequest } = useDashboard();
  const [results, setResults] = useState<Map<string, PlannerQueryResult>>(
    () => new Map()
  );

  // Persist schema into the definition when it changes after a successful fetch
  const persistSchema = useCallback(
    (defId: string, newSchema: string[], currentSchema?: string[]) => {
      const same =
        currentSchema &&
        currentSchema.length === newSchema.length &&
        currentSchema.every((k, i) => k === newSchema[i]);
      if (!same) {
        updatePlannerRequest(defId, { schema: newSchema });
      }
    },
    [updatePlannerRequest],
  );

  // Serialize definitions to detect config changes (exclude schema to avoid loops)
  const definitionsKey = useMemo(
    () =>
      JSON.stringify(
        plannerDefinitions.map(({ schema: _s, ...rest }) => rest),
      ),
    [plannerDefinitions],
  );

  useEffect(() => {
    if (plannerDefinitions.length === 0) {
      setResults(new Map());
      return;
    }

    // Mark all as loading
    setResults((prev) => {
      const next = new Map(prev);
      for (const def of plannerDefinitions) {
        next.set(def.variableName, {
          rows: next.get(def.variableName)?.rows ?? [],
          loading: true,
          error: null,
        });
      }
      return next;
    });

    let cancelled = false;

    // Fetch all definitions in parallel
    const fetchAll = async () => {
      const entries: [string, PlannerQueryResult][] = await Promise.all(
        plannerDefinitions.map(async (def): Promise<[string, PlannerQueryResult]> => {
          try {
            if (!def.pgrestFunctionName) {
              return [def.variableName, { rows: [], loading: false, error: null }];
            }
            const { url, init } = buildPgrestFetch(
              def.pgrestFunctionName,
              def.pgrestHttpMethod,
              def.pgrestParams,
              def.dataSourceId
            );
            const res = await fetch(url, init);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: unknown = await res.json();
            const rows = parseRows(data, { singleObjectFallback: true });

            // Persist discovered schema into the definition
            if (rows.length > 0) {
              persistSchema(def.id, Object.keys(rows[0]), def.schema);
            }

            return [def.variableName, { rows, loading: false, error: null }];
          } catch (err) {
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

      if (!cancelled) {
        setResults(new Map(entries));
      }
    };

    void fetchAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definitionsKey]);

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

export { EMPTY_RESULT };
