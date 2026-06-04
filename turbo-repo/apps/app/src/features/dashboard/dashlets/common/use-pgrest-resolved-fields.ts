import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { EMPTY_PGREST_PARAMS } from "./pgrest-types";
import { usePgrestRows } from "./use-pgrest-rows";
import { usePlannerData } from "./use-planner-data";
import { resolveHandlebarsField } from "./use-handlebars-templates";
import { resolveFilterParams } from "./resolve-filter-params";
import { useDashboardFilters } from "../../context/dashboard-filters-context";

interface PgrestResolvedFieldsConfig {
  dataMode: "static" | "pgrest" | "planner";
  pgrestFunctionName: string;
  pgrestHttpMethod: PgrestHttpMethod;
  pgrestParams: PgrestParam[];
  fields: Record<string, string>;
  plannerVariableName?: string;
  dataSourceId?: string;
  refreshIntervalMs?: number;
  /** JSON string used as static data row when dataMode is "static" */
  staticData?: string;
}

export interface PgrestResolvedFieldsResult {
  resolved: Record<string, string>;
  loading: boolean;
  fetchError: string | null;
  /** First row of raw data (for resolving dynamic content beyond simple fields) */
  firstRow: Record<string, string> | undefined;
}

/**
 * Hook that fetches PGREST data and resolves Handlebars fields against the first row.
 * Shared by card-style dashlets (card, labeled_data) that display scalar values.
 * Supports "planner" mode to read from PlannerContext instead of direct fetch.
 */
export function usePgrestResolvedFields({
  dataMode,
  pgrestFunctionName,
  pgrestHttpMethod,
  pgrestParams,
  fields,
  plannerVariableName,
  dataSourceId,
  refreshIntervalMs = 0,
  staticData,
}: PgrestResolvedFieldsConfig): PgrestResolvedFieldsResult {
  const { activeFilters } = useDashboardFilters();

  // Resolve {{filter.*}} templates in pgrest param values before fetching
  const resolvedParams = useMemo(
    () => resolveFilterParams(pgrestParams, activeFilters),
    [pgrestParams, activeFilters],
  );

  const stableParams = resolvedParams.length > 0 ? resolvedParams : EMPTY_PGREST_PARAMS;

  const { rows: pgrestRowsResult, loading: pgrestLoading, fetchError: pgrestError } = usePgrestRows(
    dataMode === "pgrest" ? "pgrest" : "static",
    pgrestFunctionName,
    pgrestHttpMethod,
    stableParams,
    dataSourceId,
    refreshIntervalMs,
  );

  const { rows: plannerRows, loading: plannerLoading, error: plannerError } = usePlannerData(
    dataMode === "planner" ? plannerVariableName : undefined
  );

  const rows = dataMode === "planner" ? plannerRows : pgrestRowsResult;
  const loading = dataMode === "planner" ? plannerLoading : pgrestLoading;
  const fetchError = dataMode === "planner" ? plannerError : pgrestError;

  // Parse static JSON when in static mode — used as the data row for HB resolution
  const staticRow = useMemo(() => {
    if (dataMode !== "static" || !staticData) return undefined;
    try {
      const parsed: unknown = JSON.parse(staticData);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === "object" && first !== null && !Array.isArray(first)) {
          return first as Record<string, string>;
        }
      }
    } catch { /* invalid JSON — treat as no data */ }
    return undefined;
  }, [dataMode, staticData]);

  const firstRow = dataMode === "static" ? staticRow : rows[0];

  const resolved = useMemo(() => {
    const context = firstRow
      ? { ...firstRow, row: firstRow, filter: activeFilters }
      : { filter: activeFilters };
    const out: Record<string, string> = {};
    for (const [key, template] of Object.entries(fields)) {
      out[key] = resolveHandlebarsField(template, context);
    }
    return out;
  }, [firstRow, fields, activeFilters]);

  return { resolved, loading, fetchError, firstRow };
}
