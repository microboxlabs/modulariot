"use client";

import type { SpecialView } from "../../types/fleet.types";
import Link from "next/link";
import { useParams } from "next/navigation";

interface SpecialViewCardProps {
  readonly view: SpecialView;
}

const DEFAULT_BADGE_COLOR =
  "text-green-700 bg-green-100 border-green-300";
const DEFAULT_BADGE_COLOR_DARK =
  "dark:text-green-400 dark:bg-green-900/30 dark:border-green-700";

export default function SpecialViewCard({ view }: SpecialViewCardProps) {
  const Icon = view.icon;
  const { lang } = useParams<{ lang: string }>();

  const badgeColor = view.badgeColor ?? DEFAULT_BADGE_COLOR;
  const badgeColorDark = view.badgeColorDark ?? DEFAULT_BADGE_COLOR_DARK;

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
            {view.title}
          </h3>
          {view.badgeText && (
            <span
              className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeColor} ${badgeColorDark}`}
            >
              {view.badgeText}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 text-left">
          {view.description}
        </p>
      </div>
    </Link>
  );
}
