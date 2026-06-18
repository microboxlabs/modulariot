"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HiChevronDown } from "react-icons/hi2";
import type { IconType } from "react-icons";
import type { SectionStatus } from "./vehicle-detail-accordion";

interface ExpandableSectionProps {
  readonly icon?: IconType;
  readonly customIcon?: ReactNode;
  readonly title: ReactNode;
  readonly description: string;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly defaultExpanded?: boolean;
  readonly status?: SectionStatus;
}

export default function ExpandableSection({
  icon: Icon,
  customIcon,
  title,
  description,
  badge,
  children,
  defaultExpanded = false,
  status,
}: ExpandableSectionProps) {
  // Auto-expand sections that surface issues so users see them immediately.
  // Status can flip from "ok" to "critical"/"warning" after async data loads,
  // so we also sync via effect — `useState` only runs its initializer once.
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded || status === "critical" || status === "warning"
  );
  useEffect(() => {
    if (status === "critical" || status === "warning") {
      setIsExpanded(true);
    }
  }, [status]);

  const renderIcon = () => {
    if (customIcon) {
      return <div className="shrink-0">{customIcon}</div>;
    }
    if (Icon) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={isExpanded}
      >
        {renderIcon()}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {description}
          </p>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <HiChevronDown
          className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-none opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}
