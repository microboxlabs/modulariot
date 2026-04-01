"use client";

import {
  HiOutlineClock,
  HiOutlineShieldCheck,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import type { Colaborator } from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ColaboratorStatusBadge from "./colaborator-status-badge";
import ColaboratorStatItem from "./colaborator-stat-item";
import ColaboratorPerformanceBadge from "./colaborator-performance-badge";

interface ColaboratorCardProps {
  readonly colaborator: Colaborator;
  readonly dict: I18nRecord;
  readonly onSelect?: (id: string) => void;
}

export default function ColaboratorCard({
  colaborator,
  dict,
  onSelect,
}: ColaboratorCardProps) {
  const handleClick = () => {
    onSelect?.(colaborator.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(colaborator.id);
    }
  };

  const isInteractive = Boolean(onSelect);
  const baseClasses =
    "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 transition-colors";
  const interactiveClasses =
    "cursor-pointer hover:border-gray-500 dark:hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400";

  return (
    <div
      className={`${baseClasses} ${isInteractive ? interactiveClasses : ""}`}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? "button" : undefined}
    >
      {/* Header: Avatar, Performance Score, Name, Rank, Status */}
      <div className="flex items-center gap-3">
        {/* Avatar with performance ring */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-semibold text-xl">
              {colaborator.name.charAt(0)}
            </span>
          </div>
        </div>
        
        {/* Name and Rank */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {colaborator.name}
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(`rank.${colaborator.rank}`, dict)}
          </p>
        </div>
        
        {/* Performance Score then Status */}
        <div className="flex items-center gap-2 shrink-0">
          <ColaboratorPerformanceBadge score={colaborator.score} />
          <ColaboratorStatusBadge status={colaborator.employmentStatus} dict={dict} />
        </div>
      </div>

      {/* Separator and Stats */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between gap-2">
        <ColaboratorStatItem
          icon={HiOutlineClock}
          label={tr("stats.punctuality", dict)}
          value={`${colaborator.punctuality}%`}
        />
        <ColaboratorStatItem
          icon={HiOutlineShieldCheck}
          label={tr("stats.safety", dict)}
          value={`${colaborator.safety}%`}
        />
        <ColaboratorStatItem
          icon={HiOutlineExclamationTriangle}
          label={tr("stats.incidents", dict)}
          value={`${colaborator.incidentsCount}`}
        />
      </div>
    </div>
  );
}
