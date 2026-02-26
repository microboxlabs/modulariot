"use client";

import type { SpecialView } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface SpecialViewCardProps {
  readonly view: SpecialView;
  readonly dict: I18nRecord;
}

export default function SpecialViewCard({ view, dict }: SpecialViewCardProps) {
  const Icon = view.icon;

  return (
    <div className="flex-shrink-0 w-full flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div
        className={`flex items-center justify-center w-12 h-12 rounded-xl ${view.color} ${view.darkColor}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {tr(`specialViews.${view.titleKey}`, dict)}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
          {tr(`specialViews.${view.descriptionKey}`, dict)}
        </p>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          {view.value}
        </span>
      </div>
    </div>
  );
}
