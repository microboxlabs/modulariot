import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { usePgrestRows } from "./use-pgrest-rows";
import { resolveHandlebarsField } from "./use-handlebars-templates";

const EMPTY_PARAMS: PgrestParam[] = [];

interface PgrestResolvedFieldsConfig {
  dataMode: "static" | "pgrest";
  pgrestFunctionName: string;
  pgrestHttpMethod: PgrestHttpMethod;
  pgrestParams: PgrestParam[];
  fields: Record<string, string>;
}

interface PgrestResolvedFieldsResult {
  resolved: Record<string, string>;
  loading: boolean;
  fetchError: string | null;
}

/**
 * Hook that fetches PGREST data and resolves Handlebars fields against the first row.
 * Shared by card-style dashlets (card, labeled_data) that display scalar values.
 */
export function usePgrestResolvedFields({
  dataMode,
  pgrestFunctionName,
  pgrestHttpMethod,
  pgrestParams,
  fields,
}: PgrestResolvedFieldsConfig): PgrestResolvedFieldsResult {
  const stableParams = pgrestParams.length > 0 ? pgrestParams : EMPTY_PARAMS;

  const { rows, loading, fetchError } = usePgrestRows(
    dataMode,
    pgrestFunctionName,
    pgrestHttpMethod,
    stableParams,
  );

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
