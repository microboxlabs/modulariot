"use client";

import { HiOfficeBuilding } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { OrgSummary } from "../types";

interface OrgListPanelProps {
  readonly orgs: OrgSummary[];
  readonly isLoading: boolean;
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string) => void;
  readonly dict: I18nRecord;
}

/**
 * Left-column list of organizations. Visually mirrors the top-nav
 * org switcher rows: active row highlighted with a subtle blue
 * background, child orgs show their tax id as subtitle, parents
 * show a "Cuenta principal" label.
 */
export default function OrgListPanel({
  orgs,
  isLoading,
  selectedSlug,
  onSelect,
  dict,
}: OrgListPanelProps) {
  if (isLoading) {
    return (
      <aside className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("loading", dict)}
        </div>
      </aside>
    );
  }

  if (orgs.length === 0) {
    return (
      <aside className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("empty", dict)}
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden self-start">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          {tr("listTitle", dict)}
        </h2>
      </div>
      <ul>
        {orgs.map((org, idx) => {
          const isActive = org.slug === selectedSlug;
          const isLast = idx === orgs.length - 1;
          return (
            <li key={org.slug}>
              <button
                type="button"
                onClick={() => onSelect(org.slug)}
                className={`w-full text-left flex items-center gap-3 px-4 h-16 cursor-pointer transition-all duration-300 ${
                  isActive
                    ? "bg-blue-50/50 dark:bg-blue-900/20"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${isLast ? "" : "border-b border-gray-200 dark:border-gray-700"}`}
              >
                <HiOfficeBuilding
                  className={`h-5 w-5 shrink-0 ${
                    isActive
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm truncate ${
                      isActive
                        ? "font-semibold text-blue-700 dark:text-blue-300"
                        : "font-medium text-gray-900 dark:text-white"
                    }`}
                  >
                    {org.displayName}
                  </span>
                  {org.isParent && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("parentAccount", dict)}
                    </span>
                  )}
                  {org.isParent === false && org.taxId && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {org.taxId}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
