"use client";

import { useMemo } from "react";
import { useOptionalPlannerContext } from "./planner-results";
import type {
  DashboardFilterOption,
  DashboardFilterParam,
} from "@microboxlabs/miot-dashboard-contract/document";

/** Resolved options for a "select" filter, plus the state of the source query. */
export interface ResolvedFilterOptions {
  options: DashboardFilterOption[];
  /** True while the backing planner variable is still fetching */
  loading: boolean;
  /** Error from the backing planner variable, if any */
  error: string | null;
  /** True when the filter reads its options from a planner variable */
  dynamic: boolean;
}

const EMPTY_OPTIONS: DashboardFilterOption[] = [];

/**
 * Read one cell as option text. Rows come straight off the wire, so a cell may
 * be absent or hold a nested object — which has no useful string form, and
 * cannot be an option value or label. Those read as empty.
 */
function cellText(cell: unknown): string {
  if (typeof cell === "string") return cell;
  if (
    (typeof cell === "number" && Number.isFinite(cell)) ||
    typeof cell === "boolean"
  )
    return String(cell);
  return "";
}

/**
 * Resolve the options of a "select" filter.
 *
 * Without an `optionsSource` the hand-typed `filter.options` are returned as-is.
 * With one, the rows of the referenced planner variable are projected into
 * options — deduplicated by value, blanks dropped, row order preserved.
 */
export function useFilterOptions(
  filter: DashboardFilterParam,
): ResolvedFilterOptions {
  const { results } = useOptionalPlannerContext();
  const source = filter.optionsSource;
  const result = source ? results.get(source.variableName) : undefined;
  const rows = result?.rows;

  return useMemo(() => {
    if (!source?.variableName || !source.valueField) {
      return {
        options: filter.options ?? EMPTY_OPTIONS,
        loading: false,
        error: null,
        dynamic: false,
      };
    }

    if (result?.loading || result?.error)
      return {
        options: EMPTY_OPTIONS,
        loading: result.loading,
        error: result.error,
        dynamic: true,
      };
    const labelField = source.labelField || source.valueField;
    const seen = new Set<string>();
    const options: DashboardFilterOption[] = [];

    for (const row of (rows ?? []).slice(0, 10_000)) {
      const value = cellText(
        Object.hasOwn(row, source.valueField)
          ? row[source.valueField]
          : undefined,
      );
      if (!value || value.length > 1024 || seen.has(value)) continue;
      seen.add(value);
      const label =
        cellText(
          Object.hasOwn(row, labelField) ? row[labelField] : undefined,
        ) || value;
      options.push({ label: label.slice(0, 256), value });
      if (options.length === 500) break;
    }

    return {
      options,
      loading: result?.loading ?? false,
      error: result?.error ?? null,
      dynamic: true,
    };
  }, [
    source?.variableName,
    source?.valueField,
    source?.labelField,
    rows,
    result?.loading,
    result?.error,
    filter.options,
  ]);
}
