"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ModuleCode } from "../types";

interface ModulesListProps {
  readonly modules: ModuleCode[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly dict: I18nRecord;
}

/**
 * Enabled modules rendered as badge chips. Each module code is looked up
 * in the i18n dict under `moduleNames.<code>` so the label is translated;
 * falls back to the raw code if no translation exists.
 */
export default function ModulesList({
  modules,
  isLoading,
  error,
  dict,
}: ModulesListProps) {
  return (
    <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          {tr("modulesTitle", dict)}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {tr("modulesDescription", dict)}
        </p>
      </div>
      <div className="p-4">
        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("loading", dict)}
          </p>
        )}
        {!isLoading && error != null && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadError", dict)}
          </p>
        )}
        {!isLoading && error == null && modules.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("modulesEmpty", dict)}
          </p>
        )}
        {!isLoading && error == null && modules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {modules.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {tr(`moduleNames.${code}`, dict) || code}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
