import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { usePgrestRows } from "./use-pgrest-rows";
import { usePlannerData } from "./use-planner-data";
import { resolveHandlebarsField } from "./use-handlebars-templates";

const EMPTY_PARAMS: PgrestParam[] = [];

interface PgrestResolvedFieldsConfig {
  dataMode: "static" | "pgrest" | "planner";
  pgrestFunctionName: string;
  pgrestHttpMethod: PgrestHttpMethod;
  pgrestParams: PgrestParam[];
  fields: Record<string, string>;
  plannerVariableName?: string;
}

interface PgrestResolvedFieldsResult {
  resolved: Record<string, string>;
  loading: boolean;
  fetchError: string | null;
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
}: PgrestResolvedFieldsConfig): PgrestResolvedFieldsResult {
  const stableParams = pgrestParams.length > 0 ? pgrestParams : EMPTY_PARAMS;

  const { rows: pgrestRowsResult, loading: pgrestLoading, fetchError: pgrestError } = usePgrestRows(
    dataMode === "pgrest" ? "pgrest" : "static", // only activate pgrest fetch when dataMode is pgrest
    pgrestFunctionName,
    pgrestHttpMethod,
    stableParams,
  );

  const { rows: plannerRows, loading: plannerLoading, error: plannerError } = usePlannerData(
    dataMode === "planner" ? plannerVariableName : undefined
  );

  const rows = dataMode === "planner" ? plannerRows : pgrestRowsResult;
  const loading = dataMode === "planner" ? plannerLoading : pgrestLoading;
  const fetchError = dataMode === "planner" ? plannerError : pgrestError;

  const firstRow = rows[0];

  const resolved = useMemo(() => {
    const context = firstRow ? { ...firstRow, row: firstRow } : {};
    const out: Record<string, string> = {};
    for (const [key, template] of Object.entries(fields)) {
      out[key] = resolveHandlebarsField(template, context);
    }
    return out;
  }, [firstRow, fields]);

  return { resolved, loading, fetchError };
}
