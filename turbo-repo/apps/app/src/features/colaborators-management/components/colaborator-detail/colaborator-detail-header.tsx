"use client";

import { HiArrowLeft } from "react-icons/hi2";
import type { Colaborator } from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ColaboratorStatusBadge from "../colaborator-grid/colaborator-status-badge";
import ColaboratorPerformanceBadge from "../colaborator-grid/colaborator-performance-badge";

interface ColaboratorDetailHeaderProps {
  readonly colaborator: Colaborator;
  readonly dict: I18nRecord;
  readonly onBack: () => void;
}

export default function ColaboratorDetailHeader({
  colaborator,
  dict,
  onBack,
}: ColaboratorDetailHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Colaborator info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            type="button"
            className="p-2 aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex justify-center items-center"
            aria-label={tr("detail.back", dict)}
            onClick={onBack}
          >
            <HiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <span className="text-blue-600 dark:text-blue-400 font-semibold text-xl">
              {colaborator.name.charAt(0)}
            </span>
          </div>

          {/* Name and Rank */}
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {colaborator.name}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {tr(`rank.${colaborator.rank}`, dict)}
            </span>
          </div>
        </div>

        {/* Right: Status and Performance */}
        <div className="flex items-center gap-3 shrink-0">
          <ColaboratorPerformanceBadge score={colaborator.score} />
          <ColaboratorStatusBadge status={colaborator.employmentStatus} dict={dict} />
        </div>
      </div>
    </div>
  );
}
