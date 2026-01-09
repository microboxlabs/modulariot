import "server-only";

import { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface PlanningHeaderProps {
  dict: I18nDictionary;
}

export default function PlanningHeader({
  dict,
}: Readonly<PlanningHeaderProps>) {
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {dict.layout.secured.sidebar.planning}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Placeholder for future controls: date navigation, view switcher */}
      </div>
    </div>
  );
}
