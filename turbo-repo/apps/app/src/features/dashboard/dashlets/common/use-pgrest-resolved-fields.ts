import {
  parseTemplateRow,
  createTemplateContext,
  resolveTemplateFields,
} from "@microboxlabs/miot-dashboard-ui/templates";
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
  firstRow: Record<string, unknown> | undefined;
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
    [pgrestParams, activeFilters]
  );

  const stableParams =
    resolvedParams.length > 0 ? resolvedParams : EMPTY_PGREST_PARAMS;

  const {
    rows: pgrestRowsResult,
    loading: pgrestLoading,
    fetchError: pgrestError,
  } = usePgrestRows(
    dataMode === "pgrest" ? "pgrest" : "static",
    pgrestFunctionName,
    pgrestHttpMethod,
    stableParams,
    dataSourceId,
    refreshIntervalMs
  );

  const {
    rows: plannerRows,
    loading: plannerLoading,
    error: plannerError,
  } = usePlannerData(dataMode === "planner" ? plannerVariableName : undefined);

  const rows = dataMode === "planner" ? plannerRows : pgrestRowsResult;
  const loading = dataMode === "planner" ? plannerLoading : pgrestLoading;
  const fetchError = dataMode === "planner" ? plannerError : pgrestError;

  const staticRow = useMemo(
    () => (dataMode === "static" ? parseTemplateRow(staticData) : undefined),
    [dataMode, staticData]
  );
  const firstRow = dataMode === "static" ? staticRow : rows[0];
  const resolved = useMemo(
    () =>
      resolveTemplateFields(
        fields,
        createTemplateContext({ row: firstRow, filters: activeFilters }),
        { resolveField: resolveHandlebarsField }
      ),
    [firstRow, fields, activeFilters]
  );

  return { resolved, loading, fetchError, firstRow };
}
