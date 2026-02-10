"use client";

import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

interface DayEventPanelProps {
  dict: I18nDictionary;
  currentDate: Date;
}

export default function DayEventPanel({
  currentDate,
}: Readonly<DayEventPanelProps>) {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Resumen del día
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {currentDate.toLocaleDateString()}
        </p>
      </div>

      {/* Panel Content - Placeholder for future metrics/summary */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Resumen de servicios próximamente
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Use el panel lateral para asignar servicios
          </p>
        </div>
      </div>
    </div>
  );
}
