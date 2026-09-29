import { fold, pickText } from "../localized";
import type { Selectable, SelectableGroup, SelectableOption } from "../types";

/** A static list's options for the current parent selection and search text. */
export function filterStatic(
  list: Selectable,
  search: string,
  parentValues: string[] | undefined
): SelectableOption[] {
  const needle = fold(search);
  const dependent = Boolean(list.settings?.dependsOn);
  return list.options.filter((o) => {
    if (dependent && parentValues && !parentValues.includes(o.parent ?? ""))
      return false;
    return !needle || matches(o, needle);
  });
}

function matches(o: SelectableOption, needle: string): boolean {
  return (
    fold(o.value).includes(needle) ||
    Object.values(o.label).some((t) => fold(t).includes(needle))
  );
}

export interface OptionSection {
  /** null for the options that belong to no group. */
  group: SelectableGroup | null;
  options: SelectableOption[];
}

/** Ungrouped options first, then one section per group in the list's order; empty sections are left out. */
export function sections(
  options: SelectableOption[],
  groups: SelectableGroup[]
): OptionSection[] {
  const known = new Set(groups.map((g) => g.key));
  const loose = options.filter((o) => !o.group || !known.has(o.group));
  const out: OptionSection[] = loose.length
    ? [{ group: null, options: loose }]
    : [];
  for (const group of groups) {
    const inGroup = options.filter((o) => o.group === group.key);
    if (inGroup.length) out.push({ group, options: inGroup });
  }
  return out;
}

/** Whether typing `search` may add it as a new value: tags are on and nothing matches it exactly. */
export function canCreate(
  list: Selectable,
  search: string,
  shown: SelectableOption[],
  lang: string
): boolean {
  const text = search.trim();
  if (!list.settings?.creatable || !text) return false;
  const needle = fold(text);
  return !shown.some(
    (o) => fold(o.value) === needle || fold(pickText(o.label, lang)) === needle
  );
}

/** Whether another value may be picked under the list's cap. */
export function underCap(list: Selectable, selectedCount: number): boolean {
  const max = list.mode === "MULTIPLE" ? list.settings?.maxSelections : null;
  return !max || selectedCount < max;
}

/** The option for a value, or a stand-in for a typed tag or a value no longer in the list. */
export function optionFor(
  value: string,
  known: Map<string, SelectableOption>
): SelectableOption {
  return known.get(value) ?? { value, label: { es: value } };
}
