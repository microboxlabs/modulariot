import { useMemo } from "react";
import type { DashboardFilterParam } from "../../types/dashboard.types";

/**
 * Build filter key suggestions for {{filter.*}} autocomplete.
 * Date range filters expand to _from and _to suffixes.
 * A default date_range picker is always present even without a configured filter.
 */
export function useFilterSuggestions(filters: DashboardFilterParam[]): string[] {
  return useMemo(() => {
    const keys: string[] = [];
    let hasDateRange = false;
    for (const f of filters) {
      if (f.type === "date_range") {
        keys.push(`${f.key}_from`, `${f.key}_to`);
        hasDateRange = true;
      } else {
        keys.push(f.key);
      }
    }
    if (!hasDateRange) {
      keys.push("date_range_from", "date_range_to");
    }
    return keys;
  }, [filters]);
}
