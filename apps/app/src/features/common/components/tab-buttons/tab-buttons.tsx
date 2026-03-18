"use client";

import { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface TabItem<T extends string = string> {
  /** Unique identifier for the tab */
  id: T;
  /** Label text to display */
  label: string;
  /** Optional icon to display before the label */
  icon?: ReactNode;
  /** Whether this tab is disabled */
  disabled?: boolean;
}

interface TabButtonsProps<T extends string = string> {
  /** Array of tab items to render */
  tabs: TabItem<T>[];
  /** Currently active tab ID */
  activeTab: T;
  /** Callback when a tab is clicked */
  onTabChange: (tabId: T) => void;
  /** Additional className for the container */
  className?: string;
  /** Pill style - rounds all exterior corners like a button group */
  pill?: boolean;
}

/**
 * A reusable tab buttons component following the bentobox design pattern.
 * Renders horizontal tabs with active state styling and optional icons.
 *
 * @example
 * ```tsx
 * <TabButtons
 *   tabs={[
 *     { id: "tab1", label: "Planning", icon: <HiCalendar /> },
 *     { id: "tab2", label: "Assignment", icon: <HiUserAdd /> },
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   pill
 * />
 * ```
 */
export function TabButtons<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  pill = false,
}: Readonly<TabButtonsProps<T>>) {
  return (
    <div className={twMerge("flex flex-row w-full", className)}>
      {tabs.map((tab, index) => {
        const isFirst = index === 0;
        const isLast = index === tabs.length - 1;
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;

        return (
          <div key={tab.id} className="contents">
            {/* Divider between tabs (not before first) */}
            {index > 0 && !pill && (
              <div className="h-auto w-px bg-gray-200 dark:bg-gray-600" />
            )}
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onTabChange(tab.id)}
              className={twMerge(
                "flex-1 font-light flex gap-2 items-center justify-center py-2 transition-all duration-300",
                // Default (non-pill) style - tabs with top corners rounded
                !pill && "border-t border-gray-200 dark:border-gray-600",
                !pill && isFirst && "border-l border-b rounded-tl-lg",
                !pill && isLast && "border-r border-b rounded-tr-lg",
                // Pill style - button group with full exterior rounding
                pill && "border border-gray-200 dark:border-gray-600",
                pill && isFirst && "rounded-l-lg",
                pill && isLast && "rounded-r-lg",
                pill && !isFirst && "border-l-0",
                // Active/inactive states
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-800 opacity-50 cursor-pointer text-gray-800 dark:text-gray-100",
                isDisabled && "opacity-30! cursor-not-allowed!"
              )}
            >
              {tab.icon && (
                <span
                  className={twMerge(
                    "w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4",
                    isActive ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}
                >
                  {tab.icon}
                </span>
              )}
              <span className="text-sm">{tab.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
