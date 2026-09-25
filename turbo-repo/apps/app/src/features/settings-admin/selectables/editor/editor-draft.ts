/**
 * The editor's working copy of a selectable, and the pure edits it makes. A
 * row carries a client-only `rowId` (a stable React key while values change)
 * and whether its value was typed, so an untouched value keeps following the
 * label.
 */

import { slugify, toListKey } from "../localized";
import type {
  LocalizedText,
  Selectable,
  SelectableGroup,
  SelectableOption,
  SourceKind,
} from "../types";

export interface DraftOption extends SelectableOption {
  rowId: string;
  /** Typed by hand, or already stored: the value no longer follows the label. */
  valueFixed: boolean;
}

export interface DraftGroup extends SelectableGroup {
  rowId: string;
  keyFixed: boolean;
}

export interface Draft extends Omit<Selectable, "options" | "groups"> {
  options: DraftOption[];
  groups: DraftGroup[];
  /** The key follows the name until typed, and is fixed once the list exists. */
  keyFixed: boolean;
  isNew: boolean;
}

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `row_${rowSeq}`;
}

export function blankOption(): DraftOption {
  return {
    rowId: nextRowId(),
    valueFixed: false,
    value: "",
    label: {},
    description: {},
    disabled: false,
  };
}

export function emptyDraft(): Draft {
  return {
    key: "",
    keyFixed: false,
    isNew: true,
    name: {},
    description: {},
    mode: "SINGLE",
    settings: {
      searchable: true,
      creatable: false,
      dependsOn: null,
      maxSelections: null,
      placeholder: {},
    },
    groups: [],
    source: { kind: "STATIC", ref: null, config: {} },
    options: [blankOption()],
  };
}

export function draftFrom(s: Selectable): Draft {
  return {
    ...s,
    keyFixed: true,
    isNew: false,
    settings: { ...s.settings, placeholder: s.settings?.placeholder ?? {} },
    groups: s.groups.map((g) => ({ ...g, rowId: nextRowId(), keyFixed: true })),
    options: s.options.map((o) => ({
      ...o,
      description: o.description ?? {},
      rowId: nextRowId(),
      valueFixed: true,
    })),
  };
}

/** A copy under a free key, with " (copia)" / " (copy)" on the name. */
export function duplicateDraft(s: Selectable, takenKeys: string[]): Draft {
  const draft = draftFrom(s);
  let key = `${s.key}_copy`;
  let n = 2;
  while (takenKeys.includes(key)) {
    key = `${s.key}_copy_${n}`;
    n++;
  }
  const name: LocalizedText = {};
  Object.entries(s.name).forEach(([lang, text]) => {
    name[lang] = `${text} (${lang === "es" ? "copia" : "copy"})`;
  });
  return { ...draft, key, name, isNew: true, keyFixed: false };
}

function toOption(o: DraftOption): SelectableOption {
  return {
    value: o.value,
    label: o.label,
    description: o.description,
    group: o.group ?? null,
    color: o.color ?? null,
    icon: o.icon ?? null,
    parent: o.parent ?? null,
    disabled: Boolean(o.disabled),
  };
}

/** The draft as the API takes it, without the editor's row bookkeeping. */
export function toSelectable(d: Draft): Selectable {
  return {
    key: d.key,
    name: d.name,
    description: d.description,
    mode: d.mode,
    settings:
      d.mode === "MULTIPLE"
        ? d.settings
        : { ...d.settings, maxSelections: null },
    groups: d.groups.map((g) => ({ key: g.key, label: g.label })),
    source: d.source,
    options: d.options.map(toOption),
  };
}

export function setName(d: Draft, name: LocalizedText): Draft {
  const key = d.keyFixed
    ? d.key
    : toListKey(name.es ?? Object.values(name)[0] ?? "");
  return { ...d, name, key };
}

export function setKey(d: Draft, key: string): Draft {
  return { ...d, key, keyFixed: true };
}

/** Sets one source setting; a blank one is dropped so the API's default applies. */
export function setSourceConfig(d: Draft, name: string, text: string): Draft {
  const config = { ...d.source.config };
  if (text.trim()) config[name] = text.trim();
  else delete config[name];
  return { ...d, source: { ...d.source, config } };
}

/** Parents name values of the list depended on, so they go when that list changes. */
export function setDependsOn(d: Draft, dependsOn: string | null): Draft {
  const settings = { ...d.settings, dependsOn };
  if (dependsOn === d.settings.dependsOn) return { ...d, settings };
  return {
    ...d,
    settings,
    options: d.options.map((o) => ({ ...o, parent: null })),
  };
}

export function setSourceKind(d: Draft, kind: SourceKind): Draft {
  return { ...d, source: { kind, ref: null, config: {} } };
}

/** A value unique among the other rows, made from the label. */
function valueFor(label: LocalizedText, others: DraftOption[]): string {
  const base = slugify(label.es ?? Object.values(label)[0] ?? "") || "option";
  const taken = new Set(others.map((o) => o.value));
  let value = base;
  let n = 2;
  while (taken.has(value)) {
    value = `${base}_${n}`;
    n++;
  }
  return value;
}

export function updateOption(
  d: Draft,
  rowId: string,
  patch: Partial<DraftOption>
): Draft {
  const options = d.options.map((o) => {
    if (o.rowId !== rowId) return o;
    const next = { ...o, ...patch };
    if (patch.value !== undefined) return { ...next, valueFixed: true };
    if (patch.label && !o.valueFixed) {
      return {
        ...next,
        value: valueFor(
          next.label,
          d.options.filter((x) => x.rowId !== rowId)
        ),
      };
    }
    return next;
  });
  return { ...d, options };
}

export function addOption(d: Draft): Draft {
  return { ...d, options: [...d.options, blankOption()] };
}

export function removeOption(d: Draft, rowId: string): Draft {
  return { ...d, options: d.options.filter((o) => o.rowId !== rowId) };
}

export function addGroup(d: Draft): Draft {
  return {
    ...d,
    groups: [
      ...d.groups,
      { rowId: nextRowId(), keyFixed: false, key: "", label: {} },
    ],
  };
}

export function updateGroup(
  d: Draft,
  rowId: string,
  patch: Partial<DraftGroup>
): Draft {
  const before = d.groups.find((g) => g.rowId === rowId);
  const groups = d.groups.map((g) => {
    if (g.rowId !== rowId) return g;
    const next = { ...g, ...patch };
    if (patch.key !== undefined) return { ...next, keyFixed: true };
    if (patch.label && !g.keyFixed)
      return { ...next, key: toListKey(patch.label.es ?? "") };
    return next;
  });
  const after = groups.find((g) => g.rowId === rowId);
  // Options follow their group when its key changes.
  const options =
    before && after && before.key !== after.key
      ? d.options.map((o) =>
          o.group === before.key ? { ...o, group: after.key } : o
        )
      : d.options;
  return { ...d, groups, options };
}

/** Removing a group leaves its options ungrouped. */
export function removeGroup(d: Draft, rowId: string): Draft {
  const gone = d.groups.find((g) => g.rowId === rowId);
  return {
    ...d,
    groups: d.groups.filter((g) => g.rowId !== rowId),
    options: d.options.map((o) =>
      gone && o.group === gone.key ? { ...o, group: null } : o
    ),
  };
}

/**
 * What stops a save, as an i18n key under `editor.errors`, or null. Saving is
 * an upsert, so a new list under a taken key would replace that list.
 */
export function draftProblem(
  d: Draft,
  takenKeys: readonly string[] = []
): string | null {
  if (!Object.values(d.name).some((t) => t.trim())) return "nameRequired";
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(d.key)) return "keyInvalid";
  if (d.isNew && takenKeys.includes(d.key)) return "keyTaken";
  if (d.source.kind !== "STATIC" && !d.source.ref) return "sourceRequired";
  const values = d.options
    .filter((o) => Object.values(o.label).some((t) => t.trim()))
    .map((o) => o.value);
  if (new Set(values).size !== values.length) return "duplicateValues";
  return null;
}
