"use client";

import {
  createContext,
  useContext,
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
  const { plannerDefinitions } = useDashboard();
  const [results, setResults] = useState<Map<string, PlannerQueryResult>>(
    () => new Map()
  );

  // Serialize definitions to detect config changes
  const definitionsKey = useMemo(
    () => JSON.stringify(plannerDefinitions),
    [plannerDefinitions]
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

  // Derive column schemas from the first row of each result
  const schemas = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [varName, result] of results) {
      if (result.rows.length > 0) {
        map.set(varName, Object.keys(result.rows[0]));
      }
    }
    return map;
  }, [results]);

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
