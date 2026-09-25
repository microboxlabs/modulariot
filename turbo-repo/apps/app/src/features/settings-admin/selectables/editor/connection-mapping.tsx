"use client";

import { TextInput } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { setSourceConfig, type Draft } from "./editor-draft";

interface ConnectionMappingProps {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  readonly d: I18nRecord;
}

/** The API's default for each setting, shown as the placeholder. */
const FIELDS = [
  { name: "items", label: "mappingItems", placeholder: "" },
  { name: "value", label: "mappingValue", placeholder: "id" },
  { name: "label", label: "mappingLabel", placeholder: "name" },
  { name: "parent", label: "mappingParent", placeholder: "" },
] as const;

/** Where a connection's answer holds the items, and which of their fields to show. */
export function ConnectionMapping({
  draft,
  onChange,
  d,
}: ConnectionMappingProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {tr("mappingTitle", d)}
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <label
            key={f.name}
            className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400"
          >
            {tr(f.label, d)}
            <TextInput
              sizing="sm"
              className="font-mono"
              value={String(draft.source.config?.[f.name] ?? "")}
              placeholder={f.placeholder}
              onChange={(e) =>
                onChange(setSourceConfig(draft, f.name, e.target.value))
              }
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("mappingHint", d)}
      </p>
    </div>
  );
}
