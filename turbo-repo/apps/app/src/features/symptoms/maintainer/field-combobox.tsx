"use client";

import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { OptionSectionHeader } from "@/features/settings-admin/selectables/field/field-parts";
import type { SourceField } from "./maintainer-api";
import { originLabel } from "./symptom-side-panels";

/** Lower case without accents, so "vehiculo" finds "Vehículo". */
export function folded(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** The fields whose label or path contains every word of the query, grouped by origin in source order. */
export function fieldSections(
  fields: SourceField[],
  query: string,
  d: I18nRecord
): { label: string; fields: SourceField[] }[] {
  const words = folded(query).split(/\s+/).filter(Boolean);
  const sections = new Map<string, SourceField[]>();
  for (const f of fields) {
    const text = folded(`${f.label} ${f.path}`);
    if (!words.every((w) => text.includes(w))) continue;
    const label = originLabel(f.origin, d);
    sections.set(label, [...(sections.get(label) ?? []), f]);
  }
  return [...sections].map(([label, list]) => ({ label, fields: list }));
}

/** The source field of a condition: a searchable list grouped by origin, like the selectables. */
export default function FieldCombobox({
  value,
  fields,
  readOnly,
  d,
  onChange,
}: Readonly<{
  value: string;
  fields: SourceField[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (field: SourceField) => void;
}>) {
  const [query, setQuery] = useState("");
  const byPath = new Map(fields.map((f) => [f.path, f]));
  const sections = fieldSections(fields, query, d);
  return (
    <Combobox
      value={value}
      onChange={(path: string | null) => {
        const next = path ? byPath.get(path) : undefined;
        if (next) onChange(next);
      }}
      immediate
      onClose={() => setQuery("")}
      disabled={readOnly}
    >
      <div className="relative w-64">
        <ComboboxInput
          aria-label={tr("conditionField", d)}
          placeholder={tr("searchField", d)}
          displayValue={(path: string) => byPath.get(path)?.label ?? path}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white py-1 pl-2 pr-7 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor={{ to: "bottom start", gap: 4, padding: 16 }}
        className="z-[60] w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-max-height:min(20rem,50vh)] dark:border-gray-600 dark:bg-gray-700"
      >
        {sections.length === 0 && (
          <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
            {tr("noFieldMatch", d)}
          </div>
        )}
        {sections.map((section) => (
          <div key={section.label || "_"}>
            {section.label && <OptionSectionHeader label={section.label} />}
            {section.fields.map((f) => (
              <ComboboxOption
                key={f.path}
                value={f.path}
                className="group flex cursor-default items-start gap-2 px-3 py-1 text-gray-900 data-[focus]:bg-gray-100 dark:text-white dark:data-[focus]:bg-gray-600"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {f.label}
                    {!f.engineSupported && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                        {tr("engineNotYetTag", d)}
                      </span>
                    )}
                  </span>
                  <span className="block truncate font-mono text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                    {f.path}
                  </span>
                </span>
                <HiCheck className="invisible mt-0.5 h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
              </ComboboxOption>
            ))}
          </div>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}
