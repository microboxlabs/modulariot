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
import type { MetaTemplate } from "./conversations-types";
import { matchTemplates } from "./meta-template-model";
import MetaStatusChip from "./meta-template-status";

/** The Meta template with this name, in this language when there is one. */
export function findMetaTemplate(
  list: MetaTemplate[] | undefined,
  name: string,
  language: string
): MetaTemplate | undefined {
  const named = (list ?? []).filter((t) => t.name === name);
  return named.find((t) => t.language === language) ?? named[0];
}

/** Picks a template of the WABA by name, language or category; a typed name that is not on Meta stays. */
export default function MetaTemplateCombobox({
  name,
  language,
  templates,
  readOnly,
  d,
  onPick,
  onName,
}: Readonly<{
  name: string;
  language: string;
  templates: MetaTemplate[];
  readOnly: boolean;
  d: I18nRecord;
  onPick: (template: MetaTemplate) => void;
  onName: (name: string) => void;
}>) {
  const [query, setQuery] = useState("");
  const current = findMetaTemplate(templates, name, language);
  const matches = matchTemplates(templates, query);
  const typed = query.trim();
  const custom = typed !== "" && !templates.some((t) => t.name === typed);
  return (
    <Combobox
      value={current?.id ?? null}
      onChange={(id: string | null) => {
        if (id === null) return;
        const picked = templates.find((t) => t.id === id);
        if (picked) onPick(picked);
        else onName(id);
      }}
      immediate
      onClose={() => setQuery("")}
      disabled={readOnly}
    >
      <div className="relative min-w-48 flex-1">
        <ComboboxInput
          aria-label={tr("metaName", d)}
          placeholder={tr("metaSearch", d)}
          displayValue={() => name}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white py-1 pl-2 pr-7 font-mono text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor={{ to: "bottom start", gap: 4, padding: 16 }}
        className="z-[60] w-96 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-max-height:min(20rem,50vh)] dark:border-gray-600 dark:bg-gray-700"
      >
        {custom && (
          <ComboboxOption
            value={typed}
            className="cursor-default px-3 py-1.5 text-gray-900 data-[focus]:bg-gray-100 dark:text-white dark:data-[focus]:bg-gray-600"
          >
            {tr("metaUseTyped", d, { name: typed })}
          </ComboboxOption>
        )}
        {matches.length === 0 && !custom && (
          <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
            {tr("metaNoMatch", d)}
          </div>
        )}
        {matches.map((t) => (
          <ComboboxOption
            key={t.id}
            value={t.id}
            className="group flex cursor-default items-start gap-2 px-3 py-1.5 text-gray-900 data-[focus]:bg-gray-100 dark:text-white dark:data-[focus]:bg-gray-600"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-mono">{t.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t.language}
                </span>
              </span>
              <span className="block truncate font-mono text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                {t.params.length > 0
                  ? t.params.join(", ")
                  : tr("metaNoParamsShort", d)}
              </span>
            </span>
            <MetaStatusChip status={t.status} d={d} />
            <HiCheck className="invisible mt-0.5 h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}
