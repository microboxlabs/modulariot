import { useMemo } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { usePgrestRows } from "./use-pgrest-rows";
import { resolveHandlebarsField } from "./use-handlebars-templates";

interface PgrestResolvedFieldsConfig {
  dataMode: string;
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
  const stableParams = useMemo(() => pgrestParams || [], [pgrestParams]);

  const { rows, loading, fetchError } = usePgrestRows(
    dataMode,
    pgrestFunctionName,
    pgrestHttpMethod,
    stableParams,
  );

  const context = rows.length > 0 ? { ...rows[0], row: rows[0] } : {};

  const resolved: Record<string, string> = {};
  for (const [key, template] of Object.entries(fields)) {
    resolved[key] = resolveHandlebarsField(template, context);
  }

  return { resolved, loading, fetchError };
}
