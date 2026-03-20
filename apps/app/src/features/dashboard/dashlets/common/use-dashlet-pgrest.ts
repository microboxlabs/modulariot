import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { EMPTY_PGREST_PARAMS } from "./pgrest-types";
import type { DataProviderEntry } from "../types";
import { usePgrestResolvedFields } from "./use-pgrest-resolved-fields";
import { usePgrestRows } from "./use-pgrest-rows";
import { buildDataProviderContext } from "./use-handlebars-templates";

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
      result[key] =
        typeof v === "string"
          ? v
          : typeof v === "number" || typeof v === "boolean"
            ? String(v)
            : fieldDefaults[key];
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return usePgrestResolvedFields({
    dataMode: (config.dataMode as "static" | "pgrest") || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || EMPTY_PGREST_PARAMS,
    fields,
    dataSourceId: config.dataSourceId,
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
) {
  const dataMode = (config.dataMode as "static" | "pgrest") || "static";

  const { rows, loading, fetchError } = usePgrestRows(
    dataMode,
    config.pgrestFunctionName || "",
    config.pgrestHttpMethod || "POST",
    config.pgrestParams || EMPTY_PGREST_PARAMS,
    config.dataSourceId,
  );

  const templateContext = useMemo(() => {
    const dpContext = buildDataProviderContext(dataProvider);
    if (dataMode === "pgrest" && rows.length > 0) {
      const firstRow = rows[0];
      return { ...dpContext, ...firstRow, row: firstRow };
    }
    return dpContext;
  }, [dataProvider, dataMode, rows]);

  return { templateContext, loading, fetchError };
}
