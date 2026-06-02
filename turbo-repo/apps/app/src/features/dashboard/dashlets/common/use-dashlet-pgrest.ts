import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { EMPTY_PGREST_PARAMS } from "./pgrest-types";
import type { DataProviderEntry } from "../types";
import { usePgrestResolvedFields } from "./use-pgrest-resolved-fields";
import { usePgrestRows } from "./use-pgrest-rows";
import { usePlannerData } from "./use-planner-data";
import { buildDataProviderContext } from "./use-handlebars-templates";
import { resolveFilterParams } from "./resolve-filter-params";
import { useDashboardFilters } from "../../context/dashboard-filters-context";

// ============================================================================
// Shared pgrest config interface
// ============================================================================

/** Pgrest fields common to all DashletConfig interfaces */
export interface PgrestDashletFields {
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
  plannerVariableName?: string;
  /** JSON string used as static data row when dataMode is "static" */
  staticData?: string;
}

// ============================================================================
// Pattern A: Scalar fields resolved via Handlebars
// ============================================================================

/**
 * Wraps usePgrestResolvedFields with config-level defaults.
 * Used by card-style dashlets that resolve scalar Handlebars fields.
 *
 * Accepts a `fieldDefaults` record (e.g. `{ title: "Metric", value: "0" }`)
 * and builds the memoized fields internally from config values, so each
 * dashlet component only needs a single hook call.
 */
export function useDashletPgrest<C extends PgrestDashletFields>(
  config: C,
  fieldDefaults: Record<string, string>,
  refreshIntervalMs: number = 0,
) {
  const fieldKeys = Object.keys(fieldDefaults);

  // Build a stable dep string from the config values matching field keys
  const configRecord = config as unknown as Record<string, unknown>;
  const depValues = fieldKeys.map((k) => configRecord[k]);
  const depKey = JSON.stringify(depValues);

  const fields = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of fieldKeys) {
      const v = configRecord[key];
      if (typeof v === "string") {
        result[key] = v;
      } else if (typeof v === "number" || typeof v === "boolean") {
        result[key] = String(v);
      } else {
        result[key] = fieldDefaults[key];
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return usePgrestResolvedFields({
    dataMode: (config.dataMode as "static" | "pgrest" | "planner") || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || EMPTY_PGREST_PARAMS,
    fields,
    dataSourceId: config.dataSourceId,
    plannerVariableName: config.plannerVariableName,
    staticData: config.staticData,
    refreshIntervalMs,
  });
}

// ============================================================================
// Pattern B: Hybrid data provider + pgrest context
// ============================================================================

/**
 * Wraps usePgrestRows and merges the first row into a data-provider context.
 * Used by dashlets that combine a DataProvider with optional pgrest data.
 */
export function useHybridPgrestContext(
  config: PgrestDashletFields,
  dataProvider: DataProviderEntry[],
  refreshIntervalMs: number = 0,
) {
  const dataMode = (config.dataMode as "static" | "pgrest" | "planner") || "static";
  const { activeFilters } = useDashboardFilters();

  // Resolve {{filter.*}} templates in pgrest param values
  const resolvedParams = useMemo(
    () => resolveFilterParams(config.pgrestParams || EMPTY_PGREST_PARAMS, activeFilters),
    [config.pgrestParams, activeFilters],
  );

  const { rows: pgrestRows, loading: pgrestLoading, fetchError: pgrestError } = usePgrestRows(
    dataMode === "pgrest" ? "pgrest" : "static",
    config.pgrestFunctionName || "",
    config.pgrestHttpMethod || "POST",
    resolvedParams,
    config.dataSourceId,
    refreshIntervalMs,
  );

  const { rows: plannerRows, loading: plannerLoading, error: plannerError } = usePlannerData(
    dataMode === "planner" ? config.plannerVariableName : undefined,
  );

  const rows = dataMode === "planner" ? plannerRows : pgrestRows;
  const loading = dataMode === "planner" ? plannerLoading : pgrestLoading;
  const fetchError = dataMode === "planner" ? plannerError : pgrestError;

  const templateContext = useMemo(() => {
    const dpContext = buildDataProviderContext(dataProvider);
    if ((dataMode === "pgrest" || dataMode === "planner") && rows.length > 0) {
      const firstRow = rows[0];
      return { ...firstRow, row: firstRow, ...dpContext, filter: activeFilters };
    }
    return { ...dpContext, filter: activeFilters };
  }, [dataProvider, dataMode, rows, activeFilters]);

  return { templateContext, loading, fetchError };
}
