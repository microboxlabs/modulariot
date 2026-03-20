import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { EMPTY_PGREST_PARAMS } from "./pgrest-types";
import type { DataProviderEntry } from "../types";
import { usePgrestResolvedFields } from "./use-pgrest-resolved-fields";
import { usePgrestRows } from "./use-pgrest-rows";
import { resolveHandlebarsField, buildDataProviderContext } from "./use-handlebars-templates";

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
 */
export function useDashletPgrest(
  config: PgrestDashletFields,
  fields: Record<string, string>,
) {
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
      return { ...dpContext, row: firstRow, ...firstRow };
    }
    return dpContext;
  }, [dataProvider, dataMode, rows]);

  return { templateContext, loading, fetchError };
}
