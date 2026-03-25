import type { FilterItemConfig, FilterConfig } from "./filter-types";

export interface FilterItem extends FilterItemConfig {
  _id: string;
}

export function toFilterItems(items: FilterItemConfig[]): FilterItem[] {
  return items.map((item, i) => ({ ...item, _id: `fi-${i}-${item.column}` }));
}

export function fromFilterItems(items: FilterItem[]): FilterItemConfig[] {
  return items.map(({ column, label }) => ({ column, label }));
}

/**
 * Normalize a persisted filter config into the current shape.
 * Old configs stored `{ enabled, column, label }` — convert to `{ enabled, items }`.
 */
export function normalizeFilterConfig(
  raw: unknown,
  fallback: FilterConfig,
): FilterConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const enabled =
    typeof obj.enabled === "boolean" ? obj.enabled : fallback.enabled;
  if (Array.isArray(obj.items)) {
    const validItems = obj.items
      .filter(
        (item): item is FilterItemConfig =>
          !!item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).column === "string" &&
          (item as Record<string, unknown>).column !== "",
      )
      .map((item) => ({
        column: item.column,
        label: typeof item.label === "string" ? item.label : "",
      }));
    if (validItems.length === 0) return fallback;
    return { enabled, items: validItems };
  }
  // Legacy shape: { enabled, column, label }
  if (typeof obj.column === "string" && obj.column !== "") {
    return {
      enabled,
      items: [
        {
          column: obj.column,
          label: typeof obj.label === "string" ? obj.label : "",
        },
      ],
    };
  }
  return fallback;
}
