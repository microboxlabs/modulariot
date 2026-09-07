"use client";

import type { ComponentType, SVGProps } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { PlatformSection } from "./platform.types";

export interface PlatformSectionEntry {
  readonly id: PlatformSection;
  readonly label: string;
  readonly description: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface PlatformSectionListProps {
  readonly sections: readonly PlatformSectionEntry[];
  readonly selected: PlatformSection;
  readonly onSelect: (section: PlatformSection) => void;
  readonly dict: I18nRecord;
}

/**
 * Left-column menu for Settings › Platform.
 *
 * Mirrors the organization list beside it — same panel chrome, same active
 * row treatment — because it does the same job: pick what the right column
 * shows. Platform settings are few enough that a page each would spread them
 * thinly across the sidebar.
 */
export default function PlatformSectionList({
  sections,
  selected,
  onSelect,
  dict,
}: PlatformSectionListProps) {
  return (
    <aside className="self-start overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {tr("listTitle", dict)}
        </h2>
      </div>
      <ul>
        {sections.map((section, index) => {
          const isActive = section.id === selected;
          const isLast = index === sections.length - 1;
          const Icon = section.icon;

          return (
            <li key={section.id}>
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(section.id)}
                className={`flex h-16 w-full cursor-pointer items-center gap-3 px-4 text-left transition-all duration-300 ${
                  isActive
                    ? "bg-blue-50/50 dark:bg-blue-900/20"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${isLast ? "" : "border-b border-gray-200 dark:border-gray-700"}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isActive
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${
                      isActive
                        ? "font-semibold text-blue-700 dark:text-blue-300"
                        : "font-medium text-gray-900 dark:text-white"
                    }`}
                  >
                    {section.label}
                  </span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {section.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
