import "server-only";

import { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface PlanningSidebarProps {
  dict: I18nDictionary;
}

export default function PlanningSidebar({ dict }: PlanningSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {/* Placeholder title - will be replaced with form title */}
          Asignación
        </h2>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Placeholder for assignment form */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Form content will be implemented in a future issue.
        </p>
      </div>
    </div>
  );
}
