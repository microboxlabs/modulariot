"use client";

import { Select, TextInput, ToggleSwitch } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsFormField } from "../../components/settings-form-field";
import { pickText } from "../localized";
import type { Selectable, SelectableSettings } from "../types";
import { setDependsOn, type Draft } from "./editor-draft";
import { LocalizedInput } from "./localized-input";

interface BehaviorTabProps {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  readonly d: I18nRecord;
  readonly lang: string;
  /** The organization's other lists, any of which this one may depend on. */
  readonly lists: Selectable[];
}

function parseMax(text: string): number | null {
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** How a field backed by the list behaves: search, tags, cap, dependency and placeholder. */
export function BehaviorTab({
  draft,
  onChange,
  d,
  lang,
  lists,
}: BehaviorTabProps) {
  const set = (patch: Partial<SelectableSettings>) =>
    onChange({ ...draft, settings: { ...draft.settings, ...patch } });
  const others = lists.filter(
    (l) => l.key !== draft.key && l.source.kind === "STATIC"
  );

  return (
    <div className="flex flex-col gap-5">
      <ToggleSwitch
        checked={draft.settings.searchable !== false}
        label={tr("searchableLabel", d)}
        onChange={(searchable) => set({ searchable })}
      />
      <ToggleSwitch
        checked={Boolean(draft.settings.creatable)}
        label={tr("creatableLabel", d)}
        onChange={(creatable) => set({ creatable })}
      />
      {draft.mode === "MULTIPLE" && (
        <SettingsFormField
          id="selectable-max"
          label={tr("maxSelectionsLabel", d)}
        >
          <TextInput
            id="selectable-max"
            type="number"
            min={1}
            sizing="sm"
            className="w-32"
            value={draft.settings.maxSelections ?? ""}
            onChange={(e) => set({ maxSelections: parseMax(e.target.value) })}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("maxSelectionsHint", d)}
          </p>
        </SettingsFormField>
      )}
      <SettingsFormField
        id="selectable-depends-on"
        label={tr("dependsOnLabel", d)}
      >
        <Select
          id="selectable-depends-on"
          sizing="sm"
          value={draft.settings.dependsOn ?? ""}
          onChange={(e) =>
            onChange(setDependsOn(draft, e.target.value || null))
          }
        >
          <option value="">{tr("noDependsOn", d)}</option>
          {others.map((l) => (
            <option key={l.key} value={l.key}>
              {pickText(l.name, lang)}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("dependsOnHint", d)}
        </p>
      </SettingsFormField>
      <SettingsFormField
        id="selectable-placeholder-es"
        label={tr("placeholderLabel", d)}
      >
        <LocalizedInput
          idPrefix="selectable-placeholder"
          sizing="sm"
          value={draft.settings.placeholder}
          placeholder={tr("placeholderPlaceholder", d)}
          onChange={(placeholder) => set({ placeholder })}
        />
      </SettingsFormField>
    </div>
  );
}
