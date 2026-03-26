"use client";

import { Button, TextInput } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { UseDataProviderReturn } from "./use-data-provider";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

interface DataProviderEntriesProps {
  dataProvider: UseDataProviderReturn;
  dictionary: I18nRecord;
}

/**
 * Reusable data provider key-value entries editor.
 * Renders the hint text, entry rows with TextInput pairs, and an "Add Entry" button.
 */
export function DataProviderEntries({
  dataProvider,
  dictionary,
}: Readonly<DataProviderEntriesProps>) {
  return (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.defineVariablesHint", dictionary, {
          code: "{{data_provider.key}}",
        })}
      </p>
      <div className="space-y-2">
        {dataProvider.dataProvider.map((entry, i) => (
          <div
            key={entry._id}
            className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
          >
            <TextInput
              value={entry.key}
              onChange={(e) =>
                dataProvider.updateEntry(i, "key", e.target.value)
              }
              placeholder={tr("dashboard.settings.key", dictionary)}
              sizing="sm"
              className="flex-1"
            />
            <TextInput
              value={entry.value}
              onChange={(e) =>
                dataProvider.updateEntry(i, "value", e.target.value)
              }
              placeholder={tr("common.value", dictionary)}
              sizing="sm"
              className="flex-1"
            />
            <Button
              size="xs"
              color="failure"
              aria-label={`Remove entry ${entry.key || i + 1}`}
              onClick={() => dataProvider.removeEntry(i)}
              onMouseDown={stopPropagation}
              className="no-drag shrink-0"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button
        size="xs"
        color="light"
        onClick={dataProvider.addEntry}
        onMouseDown={stopPropagation}
        className="no-drag w-full"
      >
        {tr("dashboard.settings.addEntry", dictionary)}
      </Button>
    </>
  );
}
