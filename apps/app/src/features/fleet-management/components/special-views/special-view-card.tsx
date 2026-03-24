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
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-600 dark:border-gray-600 rounded-xl p-4 min-w-0">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${view.iconColor} ${view.iconDarkColor}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {tr(`specialViews.${view.titleKey}`, dict)}
          </h3>
          <span className="shrink-0 text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded border border-green-300 dark:border-green-700">
            {tr("specialViews.badge", dict)}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
          {tr(`specialViews.${view.descriptionKey}`, dict)}
        </p>
      </div>
    </div>
  );
}
