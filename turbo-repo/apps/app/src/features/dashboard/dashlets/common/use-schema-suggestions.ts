"use client";

import { useMemo } from "react";
import { usePlannerContext } from "../../context/planner-context";

interface UseSchemaSuggestionsOptions {
  dataMode: string;
  /** Raw JSON string used in static mode */
  rowsJson?: string;
  /** Sample rows returned from a pgrest / dynamic source */
  sampleRows?: Record<string, unknown>[];
  plannerVariableName?: string;
}

/**
 * Single source of truth for Handlebars {{row.*}} autocomplete suggestions.
 *
 * Priority: planner schema → pgrest sample rows → parsed static JSON.
 * Returns undefined when no data source is configured yet.
 */
export function useSchemaSuggestions({
  dataMode,
  rowsJson,
  sampleRows,
  plannerVariableName,
}: UseSchemaSuggestionsOptions): string[] | undefined {
  const { schemas } = usePlannerContext();

  const staticKeys = useMemo((): string[] | undefined => {
    if (dataMode !== "static" || !rowsJson?.trim()) return undefined;
    try {
      const parsed: unknown = JSON.parse(rowsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Object.keys(parsed[0] as Record<string, unknown>);
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed);
      }
    } catch { /* invalid JSON — wait for user to finish typing */ }
    return undefined;
  }, [dataMode, rowsJson]);

  return useMemo(() => {
    if (dataMode === "planner" && plannerVariableName) {
      return schemas.get(plannerVariableName);
    }
    if (sampleRows && sampleRows.length > 0) {
      return Object.keys(sampleRows[0]);
    }
    return staticKeys;
  }, [dataMode, plannerVariableName, schemas, sampleRows, staticKeys]);
}
