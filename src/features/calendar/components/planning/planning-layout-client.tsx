"use client";

import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import {
  PlanningSelectionProvider,
  usePlanningSelection,
} from "./planning-selection-context";
import { PlanningSidebarClient } from "./planning-sidebar-client";

interface PlanningLayoutClientProps {
  lang: string;
  dict: I18nDictionary;
  header: ReactNode;
  calendar: ReactNode;
}

/**
 * Inner layout component that can access the selection context
 */
function PlanningLayoutInner({
  dict,
  header,
  calendar,
}: Omit<PlanningLayoutClientProps, "lang">) {
  const { isSidebarOpen } = usePlanningSelection();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      {header}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Area - Calendar */}
        <div className="flex-1 p-4 overflow-hidden bg-gray-50 dark:bg-gray-900 transition-all duration-300">
          <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-auto">
            {calendar}
          </div>
        </div>

        {/* Right Sidebar - Form (animated) */}
        <div
          className={twMerge(
            "hidden lg:block shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
            isSidebarOpen ? "w-80" : "w-0"
          )}
        >
          <div className="w-80 h-full">
            <PlanningSidebarClient dict={dict} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Client-side layout wrapper that provides selection context
 * for communication between calendar and sidebar
 */
export function PlanningLayoutClient({
  dict,
  header,
  calendar,
}: PlanningLayoutClientProps) {
  return (
    <PlanningSelectionProvider>
      <PlanningLayoutInner dict={dict} header={header} calendar={calendar} />
    </PlanningSelectionProvider>
  );
}
