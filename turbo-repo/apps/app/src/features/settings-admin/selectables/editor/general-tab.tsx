"use client";

import { Select, TextInput } from "flowbite-react";
import { SegmentedSwitcher } from "@/features/common/components/view-switcher/segmented-switcher";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsFormField } from "../../components/settings-form-field";
import { pickText } from "../localized";
import type {
  SelectableSourceDescriptor,
  SelectionMode,
  SourceKind,
} from "../types";
import { setKey, setName, setSourceKind, type Draft } from "./editor-draft";
import { LocalizedInput } from "./localized-input";

interface GeneralTabProps {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  /** The `selectables.editor` dictionary section. */
  readonly d: I18nRecord;
  readonly lang: string;
  readonly sources: SelectableSourceDescriptor[];
}

export function GeneralTab({
  draft,
  onChange,
  d,
  lang,
  sources,
}: GeneralTabProps) {
  const offered = sources.filter((s) => s.kind === draft.source.kind);
  const picked = offered.find((s) => s.ref === draft.source.ref);

  return (
    <div className="flex flex-col gap-5">
      <SettingsFormField id="selectable-name-es" label={tr("nameLabel", d)}>
        <LocalizedInput
          idPrefix="selectable-name"
          value={draft.name}
          placeholder={tr("namePlaceholder", d)}
          onChange={(name) => onChange(setName(draft, name))}
        />
      </SettingsFormField>

      <SettingsFormField id="selectable-key" label={tr("keyLabel", d)}>
        <TextInput
          id="selectable-key"
          sizing="sm"
          value={draft.key}
          disabled={!draft.isNew}
          onChange={(e) => onChange(setKey(draft, e.target.value))}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {draft.isNew ? tr("keyHintNew", d) : tr("keyHintFixed", d)}
        </p>
      </SettingsFormField>

      <SettingsFormField
        id="selectable-description-es"
        label={tr("descriptionLabel", d)}
      >
        <LocalizedInput
          idPrefix="selectable-description"
          multiline
          value={draft.description}
          placeholder={tr("descriptionPlaceholder", d)}
          onChange={(description) => onChange({ ...draft, description })}
        />
      </SettingsFormField>

      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {tr("modeLabel", d)}
          </span>
          <SegmentedSwitcher<SelectionMode>
            size="sm"
            label={tr("modeLabel", d)}
            active={draft.mode}
            onChange={(mode) => onChange({ ...draft, mode })}
            options={[
              { value: "SINGLE", label: tr("modeSingle", d) },
              { value: "MULTIPLE", label: tr("modeMultiple", d) },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {tr("sourceLabel", d)}
          </span>
          <SegmentedSwitcher<SourceKind>
            size="sm"
            label={tr("sourceLabel", d)}
            active={draft.source.kind}
            onChange={(kind) => onChange(setSourceKind(draft, kind))}
            options={[
              { value: "STATIC", label: tr("sourceStatic", d) },
              { value: "SYSTEM", label: tr("sourceSystem", d) },
              { value: "CONNECTION", label: tr("sourceConnection", d) },
            ]}
          />
        </div>
      </div>

      {draft.source.kind !== "STATIC" && (
        <SettingsFormField
          id="selectable-source"
          label={tr("sourcePickLabel", d)}
        >
          <Select
            id="selectable-source"
            sizing="sm"
            value={draft.source.ref ?? ""}
            onChange={(e) =>
              onChange({
                ...draft,
                source: { ...draft.source, ref: e.target.value || null },
              })
            }
          >
            <option value="">
              {offered.length
                ? tr("sourcePickPlaceholder", d)
                : tr("noSources", d)}
            </option>
            {offered.map((s) => (
              <option key={s.ref} value={s.ref}>
                {pickText(s.label, lang)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {pickText(picked?.description, lang) || tr("dynamicHint", d)}
          </p>
        </SettingsFormField>
      )}
    </div>
  );
}
