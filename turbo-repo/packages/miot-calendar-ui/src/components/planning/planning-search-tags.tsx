"use client";

import { useCallback } from "react";
import { HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { useCalendarHost } from "../../context/calendar-provider";

export interface SearchTag {
  matchType: string;
  value: string;
}

export interface PlanningSearchTagsProps {
  tags: SearchTag[];
  onTagsChange: (tags: SearchTag[]) => void;
  /** Resolve the display label for a tag's matchType (host owns i18n). */
  labelFor: (matchType: string) => string;
}

/**
 * Generic, domain-agnostic chip list of active search filters. Each chip shows
 * "{label}: {value}" with a remove button; the host resolves match-type labels
 * via {@link PlanningSearchTagsProps.labelFor}. Faithful to the freight
 * planning-search-tags look.
 */
export function PlanningSearchTags({
  tags,
  onTagsChange,
  labelFor,
}: Readonly<PlanningSearchTagsProps>) {
  const host = useCalendarHost();
  const clearLabel = host.i18n.tr(
    "pages.planning.sidebar.search.clear",
    host.i18n.dict
  );

  const handleRemove = useCallback(
    (index: number) => {
      onTagsChange(tags.filter((_, i) => i !== index));
    },
    [tags, onTagsChange]
  );

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <div
          key={`${tag.matchType}-${tag.value}-${index}`}
          className={twMerge(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
            "bg-blue-50 dark:bg-blue-900/30",
            "border border-blue-200 dark:border-blue-700",
            "transition-all",
            "text-sm",
            "hover:bg-blue-100 dark:hover:bg-blue-800/40"
          )}
        >
          <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
            {labelFor(tag.matchType)}: {tag.value}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(index);
            }}
            className="ml-0.5 p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
            aria-label={clearLabel}
          >
            <HiX className="w-3 h-3 text-blue-700 dark:text-blue-300" />
          </button>
        </div>
      ))}
    </div>
  );
}
