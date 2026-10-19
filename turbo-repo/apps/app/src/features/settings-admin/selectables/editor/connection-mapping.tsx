"use client";

import { useMemo } from "react";
import { TemplateInput } from "@/features/common/templating/template-input";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { checkTemplate } from "@/features/shipping/components/lane/review-template-validation";
import {
  ITEM_ROOTS,
  checkItems,
  itemFields,
  responseLists,
} from "./connection-fields";
import { setSourceConfig, sourceConfigText, type Draft } from "./editor-draft";
import { useConnectionSchema } from "./use-connection-schema";

interface ConnectionMappingProps {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  readonly d: I18nRecord;
}

/** The API's default for each setting, shown as the placeholder. */
const FIELDS = [
  { name: "items", label: "mappingItems", placeholder: "{{response.data}}" },
  { name: "value", label: "mappingValue", placeholder: "{{item.id}}" },
  { name: "label", label: "mappingLabel", placeholder: "{{item.name}}" },
  { name: "description", label: "mappingDescription", placeholder: "" },
  { name: "parent", label: "mappingParent", placeholder: "" },
] as const;

const COLOR = { invalid: "failure", valid: "success", none: "gray" } as const;

/**
 * How a connection's answer becomes options, written in the payload template
 * language with the same `{{` autocomplete as the binding drawers. Fields are
 * suggested from the response schema of the connection's template.
 */
export function ConnectionMapping({
  draft,
  onChange,
  d,
}: ConnectionMappingProps) {
  const ref = draft.source.ref ?? "";
  const { schema, loading } = useConnectionSchema(ref);
  const itemsTemplate = sourceConfigText(draft, "items");

  const lists = useMemo(() => responseLists(schema), [schema]);
  const responseNamespaces = useMemo(
    () => [
      { prefix: "response", suggestions: [...lists.keys()].filter(Boolean) },
    ],
    [lists]
  );
  const itemNamespaces = useMemo(
    () => [{ prefix: "item", suggestions: itemFields(lists, itemsTemplate) }],
    [lists, itemsTemplate]
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {tr("mappingTitle", d)}
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const value = sourceConfigText(draft, f.name);
          const isItems = f.name === "items";
          const check = isItems
            ? checkItems(value)
            : checkTemplate(value, ITEM_ROOTS);
          return (
            <label
              key={f.name}
              className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400"
            >
              {tr(f.label, d)}
              <TemplateInput
                value={value}
                placeholder={f.placeholder}
                namespaces={isItems ? responseNamespaces : itemNamespaces}
                color={COLOR[check.status]}
                onChange={(next) =>
                  onChange(setSourceConfig(draft, f.name, next))
                }
              />
              {check.status === "invalid" && (
                <span className="text-red-600 dark:text-red-400">
                  {tr("mappingInvalid", d)} ({check.problem?.code})
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("mappingHint", d)}
      </p>
      {ref && !loading && !schema && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("mappingNoSchema", d)}
        </p>
      )}
    </div>
  );
}
