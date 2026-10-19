import { useCallback, useMemo } from "react";
import type { DashboardFilterParam } from "@microboxlabs/miot-dashboard-contract/document";

export interface DashboardFilterController {
  definitions: readonly DashboardFilterParam[];
  values: Readonly<Record<string, string>>;
  onChange: (values: Record<string, string>) => void;
}

function keysForDefinition(definition: DashboardFilterParam): string[] {
  return definition.type === "date_range"
    ? [`${definition.key}_from`, `${definition.key}_to`]
    : [definition.key];
}

function configuredKeys(definitions: readonly DashboardFilterParam[]) {
  const keys = new Set(definitions.flatMap(keysForDefinition));
  if (!definitions.some((definition) => definition.type === "date_range")) {
    keys.add("date_range_from");
    keys.add("date_range_to");
  }
  return keys;
}

/** Host-controlled filters. Reads no URL, browser storage or global state. */
export function useDashboardFilterState({
  definitions,
  values,
  onChange,
}: DashboardFilterController) {
  const keys = useMemo(() => configuredKeys(definitions), [definitions]);
  const activeFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== ""),
      ),
    [values],
  );
  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = { ...values };
      const definition =
        definitions.find((item) => item.key === key) ??
        definitions.find((item) => keysForDefinition(item).includes(key));
      if (definition?.unique && value) {
        for (const configured of keysForDefinition(definition))
          delete next[configured];
      }
      if (value)
        Object.defineProperty(next, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      else delete next[key];
      onChange(next);
    },
    [definitions, values, onChange],
  );
  const removeFilter = useCallback(
    (key: string) => {
      const next = { ...values };
      delete next[key];
      onChange(next);
    },
    [values, onChange],
  );
  const clearFilters = useCallback(() => {
    const next = { ...values };
    for (const key of keys) delete next[key];
    onChange(next);
  }, [values, keys, onChange]);
  return useMemo(
    () => ({ activeFilters, setFilter, removeFilter, clearFilters }),
    [activeFilters, setFilter, removeFilter, clearFilters],
  );
}
