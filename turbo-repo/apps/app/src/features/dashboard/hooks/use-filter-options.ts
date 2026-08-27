"use client";

import { useMemo } from "react";
import { useOptionalPlannerContext } from "../context/planner-context";
import type {
  DashboardFilterOption,
  DashboardFilterParam,
} from "../types/dashboard.types";

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
 * Resolve the options of a "select" filter.
 *
 * Without an `optionsSource` the hand-typed `filter.options` are returned as-is.
 * With one, the rows of the referenced planner variable are projected into
 * options — deduplicated by value, blanks dropped, row order preserved.
 */
export function useFilterOptions(
  filter: DashboardFilterParam
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

    const labelField = source.labelField || source.valueField;
    const seen = new Set<string>();
    const options: DashboardFilterOption[] = [];

    for (const row of rows ?? []) {
      // Rows come straight off the wire — cells may be absent or non-string.
      const rawValue: unknown = row[source.valueField];
      if (rawValue === undefined || rawValue === null || rawValue === "") continue;
      const value = String(rawValue);
      if (seen.has(value)) continue;
      seen.add(value);
      const rawLabel: unknown = row[labelField];
      const blankLabel = rawLabel === undefined || rawLabel === null || rawLabel === "";
      options.push({ label: blankLabel ? value : String(rawLabel), value });
    }

    return {
      options,
      loading: result?.loading ?? false,
      error: result?.error ?? null,
      dynamic: true,
    };
  }, [source?.variableName, source?.valueField, source?.labelField, rows, result?.loading, result?.error, filter.options]);
}
