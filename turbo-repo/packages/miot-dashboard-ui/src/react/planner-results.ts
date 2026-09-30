"use client";
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { PlannerRequestDefinition } from "@microboxlabs/miot-dashboard-contract/document";

export interface PlannerQueryResult {
  rows: Record<string, string>[];
  loading: boolean;
  error: string | null;
}
export interface PlannerContextValue {
  results: ReadonlyMap<string, PlannerQueryResult>;
  definitions: readonly PlannerRequestDefinition[];
  schemas: ReadonlyMap<string, string[]>;
}
const PlannerContext = createContext<PlannerContextValue | null>(null);
/** Host-owned query results; this provider never executes a query. */
export function PlannerResultsProvider({
  value,
  children,
}: Readonly<PropsWithChildren<{ value: PlannerContextValue }>>) {
  return createElement(PlannerContext.Provider, { value }, children);
}
export function usePlannerContext(): PlannerContextValue {
  const value = useContext(PlannerContext);
  if (!value)
    throw new Error(
      "usePlannerContext must be used within a PlannerResultsProvider",
    );
  return value;
}
/** Optional consumers receive a separate empty fallback per mounted hook. */
export function useOptionalPlannerContext(): PlannerContextValue {
  const value = useContext(PlannerContext);
  const fallback = useMemo<PlannerContextValue>(
    () => ({ results: new Map(), definitions: [], schemas: new Map() }),
    [],
  );
  return value ?? fallback;
}
