"use client";

import { HiOutlineOfficeBuilding } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { PlatformOrganizationListItem } from "../platform/platform.types";

interface PlatformOrgListPanelProps {
  readonly orgs: PlatformOrganizationListItem[];
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string) => void;
  readonly dict: I18nRecord;
}

function rowClasses(isSelected: boolean, isLast: boolean): string {
  const state = isSelected
    ? "bg-blue-50/50 dark:bg-blue-900/20"
    : "hover:bg-gray-100 dark:hover:bg-gray-700";
  const border = isLast ? "" : "border-b border-gray-200 dark:border-gray-700";
  return `w-full text-left flex items-center gap-3 px-4 h-16 cursor-pointer transition-all duration-300 ${state} ${border}`;
}

/**
 * Organizations a platform owner can see but does not belong to. Listed under
 * the caller's own organizations, in the same row style.
 */
export default function PlatformOrgListPanel({
  orgs,
  selectedSlug,
  onSelect,
  dict,
}: PlatformOrgListPanelProps) {
  if (orgs.length === 0) return null;

  return (
    <aside className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden self-start">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          {tr("otherOrgsTitle", dict)}
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("otherOrgsHint", dict)}
        </p>
      </div>
      <ul>
        {orgs.map((org, idx) => (
          <li key={org.slug}>
            <button
              type="button"
              onClick={() => onSelect(org.slug)}
              className={rowClasses(
                org.slug === selectedSlug,
                idx === orgs.length - 1
              )}
            >
              <HiOutlineOfficeBuilding className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate text-gray-900 dark:text-white">
                  {org.displayName ?? org.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {org.slug}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
