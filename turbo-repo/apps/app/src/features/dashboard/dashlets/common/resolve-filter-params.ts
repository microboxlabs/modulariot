import type { PgrestParam } from "./pgrest-types";
import { EMPTY_PGREST_PARAMS } from "./pgrest-types";
import { resolveHandlebarsField } from "./use-handlebars-templates";

/**
 * Resolve {{filter.*}} Handlebars templates in pgrest parameter values.
 * Returns a clean param array with resolved values; template-derived params
 * that resolve to empty or incomplete values (e.g. "eq.") are dropped.
 */
export function resolveFilterParams(
  params: PgrestParam[],
  activeFilters: Record<string, string>,
): PgrestParam[] {
  if (params.length === 0) return EMPTY_PGREST_PARAMS;
  const filterContext = { filter: activeFilters };
  const resolved = params.map((p) => {
    if (p.value?.includes("{{filter.")) {
      const resolvedValue = resolveHandlebarsField(p.value, filterContext);
      return { ...p, value: resolvedValue, _fromTemplate: true };
    }
    return { ...p, _fromTemplate: false };
  });
  return resolved
    .filter((p) => {
      if (!p._fromTemplate) return true;
      // Drop template params that resolved to empty or operator-only (e.g. "eq.", "like.")
      return p.value !== "" && !p.value.endsWith(".");
    })
    .map(({ _fromTemplate, ...p }) => p);
}
