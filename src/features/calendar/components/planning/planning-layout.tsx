import "server-only";

import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import PlanningHeader from "./planning-header";
import PlanningSidebar from "./planning-sidebar";

interface PlanningLayoutProps {
  lang: string;
  dict: I18nDictionary;
}

export default function PlanningLayout({ lang, dict }: Readonly<PlanningLayoutProps>) {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <PlanningHeader lang={lang} dict={dict} />

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Area - Calendar */}
        <div className="flex-1 p-4 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            {/* Placeholder for calendar component */}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Calendar component will be implemented in a future issue.
            </p>
          </div>
        </div>

        {/* Right Sidebar - Form */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          <PlanningSidebar dict={dict} />
        </div>
      </div>
    </div>
  );
}
