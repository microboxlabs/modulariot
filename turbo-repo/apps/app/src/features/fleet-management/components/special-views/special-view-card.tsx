"use client";

import type { SpecialView } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import Link from "next/link";
import { useParams } from "next/navigation";

interface SpecialViewCardProps {
  readonly view: SpecialView;
  readonly dict: I18nRecord;
}

export default function SpecialViewCard({ view, dict }: SpecialViewCardProps) {
  const Icon = view.icon;
  const { lang } = useParams<{ lang: string }>();

  return (
    <Link
      href={`/${lang}/${view.route}`}
      className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 min-w-0 h-full hover:border-gray-400 dark:hover:border-gray-400 transition-colors cursor-pointer"
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${view.iconColor} ${view.iconDarkColor}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
            {tr(`specialViews.${view.titleKey}`, dict)}
          </h3>
          <span className="shrink-0 text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded border border-green-300 dark:border-green-700">
            {tr("specialViews.badge", dict)}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 text-left">
          {tr(`specialViews.${view.descriptionKey}`, dict)}
        </p>
      </div>
    </Link>
  );
}
