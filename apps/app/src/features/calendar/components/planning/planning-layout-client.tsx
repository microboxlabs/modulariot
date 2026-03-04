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
  readonly dict: I18nDictionary;
  readonly header: ReactNode;
  readonly calendar: ReactNode;
  readonly calendarId?: string;
  /** Slot duration in minutes (default: 30) */
  readonly slotDurationMinutes?: number;
}

/**
 * Inner layout component that can access the selection context
 */
function PlanningLayoutInner({
  dict,
  header,
  calendar,
}: Readonly<Omit<PlanningLayoutClientProps, "lang">>) {
  const { isSidebarOpen } = usePlanningSelection();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      {header}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Area - Calendar */}
        <div className="h-full w-full bg-white dark:bg-gray-800 p-4 overflow-auto">
          {calendar}
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
  calendarId,
  slotDurationMinutes,
}: PlanningLayoutClientProps) {
  return (
    <PlanningSelectionProvider calendarId={calendarId} slotDurationMinutes={slotDurationMinutes}>
      <PlanningLayoutInner dict={dict} header={header} calendar={calendar} />
    </PlanningSelectionProvider>
  );
}
