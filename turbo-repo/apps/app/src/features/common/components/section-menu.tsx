"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";

export interface SectionMenuEntry<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly description: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Rows with a group get a heading above the first of them. */
  readonly group?: string;
}

/** Left-column menu of a settings page with a list beside its detail (Plataforma, Comunicaciones). */
export default function SectionMenu<T extends string>({
  title,
  sections,
  selected,
  onSelect,
}: Readonly<{
  title: ReactNode;
  sections: readonly SectionMenuEntry<T>[];
  selected: T;
  onSelect: (section: T) => void;
}>) {
  return (
    <aside className="self-start overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <ul>
        {sections.map((section, index) => {
          const isActive = section.id === selected;
          const isLast = index === sections.length - 1;
          const heading =
            section.group && section.group !== sections[index - 1]?.group
              ? section.group
              : null;
          const Icon = section.icon;

          return (
            <li key={section.id}>
              {heading && (
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                  {heading}
                </div>
              )}
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
