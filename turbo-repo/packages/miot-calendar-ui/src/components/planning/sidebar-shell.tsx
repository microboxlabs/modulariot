"use client";

import type { ReactNode } from "react";
import { HiArrowLeft, HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { CalendarItem } from "../../types/calendar-item";
import { ItemCard } from "../item-card";
import { useCalendarHost } from "../../context/calendar-provider";

/** Formatted selected-slot times for the sidebar slot-display bar. */
export interface SidebarShellFormattedSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface SidebarShellProps {
  /** When true the content area shows the form slot; otherwise the item list. */
  isFormActive: boolean;
  /** Header title (resolved by the host). */
  headerTitle: string;
  /** Business id of the selected item, shown as a mono badge in the header. */
  selectedItemId?: string;
  /** Selected-slot summary shown above the header (omitted when no slot). */
  formattedSlot?: SidebarShellFormattedSlot;
  /** Prefix label for the slot-display bar (e.g. "Horario"). */
  slotLabel: string;
  /** Show an X (close) button instead of the back arrow. */
  showCloseButton: boolean;
  /** aria-label for the back button. */
  backLabel: string;
  /** aria-label for the close button. */
  closeLabel: string;
  onBack: () => void;
  onClose: () => void;
  /** Optional banner above the search chrome (e.g. reassignment mode). */
  banner?: ReactNode;
  /** Search box slot (host renders the autocomplete). */
  search?: ReactNode;
  /** Active-filter chips slot (host renders the tag list). */
  tags?: ReactNode;
  /** Items shown in the list; each rendered via the host card seam. */
  items: CalendarItem[];
  /** Item id to highlight with a ring (e.g. the one being reassigned). */
  highlightItemId?: string;
  /** Empty-state text shown when there are no items. */
  emptyText: string;
  /** Hint text shown below the list. */
  hintText: string;
  /** Form slot rendered when {@link SidebarShellProps.isFormActive} is true. */
  form?: ReactNode;
}

/**
 * Generic, domain-agnostic sidebar frame for the planning calendar: the
 * selected-slot bar, header (back/close + title + id badge), and the scrollable
 * content area that toggles between an item list and a form. Each listed item
 * renders via `useCalendarHost().renderItemCard ?? <ItemCard/>`; all domain
 * data (items, search chrome, banner, form, copy) is injected by the host so
 * the shell stays free of freight knowledge.
 */
export function SidebarShell({
  isFormActive,
  headerTitle,
  selectedItemId,
  formattedSlot,
  slotLabel,
  showCloseButton,
  backLabel,
  closeLabel,
  onBack,
  onClose,
  banner,
  search,
  tags,
  items,
  highlightItemId,
  emptyText,
  hintText,
  form,
}: Readonly<SidebarShellProps>) {
  const host = useCalendarHost();
  const renderCard =
    host.renderItemCard ?? ((item: CalendarItem) => <ItemCard item={item} />);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Selected slot display */}
      {formattedSlot && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {slotLabel}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">
              {formattedSlot.date}
            </span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formattedSlot.startTime}
            </span>
            <span className="text-gray-300 dark:text-gray-600">→</span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formattedSlot.endTime}
            </span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 h-10">
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 rounded-md transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              aria-label={closeLabel}
            >
              <HiX className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 rounded-md transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              aria-label={backLabel}
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {headerTitle}
          </h2>
          {selectedItemId && (
            <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
              {selectedItemId}
            </span>
          )}
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        {isFormActive ? (
          form
        ) : (
          <div className="flex flex-col gap-3">
            {banner}

            {search}

            {tags}

            {/* Items list */}
            <div className="flex flex-col gap-1.5">
              {items.length > 0 ? (
                items.map((item) => (
                  <div
                    key={item.id}
                    className={twMerge(
                      "rounded-xl",
                      item.id === highlightItemId &&
                        "ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800"
                    )}
                  >
                    {renderCard(item)}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {emptyText}
                </p>
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              {hintText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
