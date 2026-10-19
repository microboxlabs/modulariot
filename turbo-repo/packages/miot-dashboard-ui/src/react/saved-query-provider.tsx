"use client";

import { useMemo, type PropsWithChildren } from "react";
import {
  PlannerResultsProvider,
  useOptionalPlannerContext,
  type PlannerQueryResult,
} from "./planner-results";
import {
  useSavedQueryResults,
  type SavedQueryOptions,
} from "./use-saved-query-results";

/** Executes only saved server queries and exposes planner-compatible results to children. */
export function SavedQueryProvider({
  children,
  ...options
}: Readonly<PropsWithChildren<SavedQueryOptions>>) {
  const value = useSavedQueryResults(options);
  return (
    <PlannerResultsProvider value={value}>{children}</PlannerResultsProvider>
  );
}

/** Read one named result without executing a query; standalone widgets receive an empty result. */
export function usePlannerData(variableName?: string): PlannerQueryResult {
  const { results } = useOptionalPlannerContext();
  const empty = useMemo<PlannerQueryResult>(
    () => ({ rows: [], loading: false, error: null }),
    [],
  );
  return variableName ? (results.get(variableName) ?? empty) : empty;
}
