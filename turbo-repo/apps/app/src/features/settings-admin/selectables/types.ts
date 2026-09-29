/**
 * PROTOTYPE — "Selectables" data model.
 *
 * A selectable is a named, described list of options plus a selection mode
 * (single / multiple). It backs the selectors used across the treatment forms
 * ("Who to call", "Call result", …). Persisted per-browser only for now
 * (see `store.ts`); no backend.
 */

export type SelectionMode = "single" | "multiple";

export interface SelectableOption {
  id: string;
  name: string;
  description: string;
}

export interface Selectable {
  id: string;
  name: string;
  description: string;
  mode: SelectionMode;
  options: SelectableOption[];
}
