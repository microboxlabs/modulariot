/**
 * Selectables, as the modulith core API returns them: a named list of options
 * plus how a field backed by it behaves. Texts are per language
 * (`{ es: "…", en: "…" }`); an option's `value` is the stable code records
 * store, its `label` what people see.
 */

export type LocalizedText = Record<string, string>;

export type SelectionMode = "SINGLE" | "MULTIPLE";

export type SourceKind = "STATIC" | "SYSTEM" | "CONNECTION";

export interface SelectableOption {
  value: string;
  label: LocalizedText;
  description?: LocalizedText;
  /** Key of one of the list's groups. */
  group?: string | null;
  /** A Flowbite badge color, see `SELECTABLE_COLORS`. */
  color?: string | null;
  /** A name from `SELECTABLE_ICONS`. */
  icon?: string | null;
  /** Value of the option in the `dependsOn` list this one belongs under. */
  parent?: string | null;
  disabled?: boolean;
}

export interface SelectableGroup {
  key: string;
  label: LocalizedText;
}

export interface SelectableSettings {
  /** null means yes. */
  searchable?: boolean | null;
  /** People may type a value that is not in the list (tags). */
  creatable?: boolean | null;
  /** Key of the list whose selection filters this one by `parent`. */
  dependsOn?: string | null;
  maxSelections?: number | null;
  placeholder?: LocalizedText | null;
}

export interface SelectableSource {
  kind: SourceKind;
  /** SYSTEM: the source id; CONNECTION: the connection id. */
  ref?: string | null;
  config?: Record<string, unknown>;
}

export interface Selectable {
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  mode: SelectionMode;
  settings: SelectableSettings;
  groups: SelectableGroup[];
  source: SelectableSource;
  options: SelectableOption[];
  updatedBy?: string | null;
  updatedAt?: string | null;
}

/** A source an editor can pick for a dynamic list. */
export interface SelectableSourceDescriptor {
  kind: SourceKind;
  ref: string;
  label: LocalizedText;
  description?: LocalizedText;
}

/** Languages the editor offers, in order; the first is the fallback. */
export const SELECTABLE_LANGUAGES = ["es", "en"] as const;

export const SELECTABLE_COLORS = [
  "gray",
  "blue",
  "green",
  "red",
  "yellow",
  "indigo",
  "purple",
  "pink",
  "cyan",
  "teal",
  "lime",
] as const;
