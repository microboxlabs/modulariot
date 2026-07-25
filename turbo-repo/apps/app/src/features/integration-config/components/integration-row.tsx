"use client";

import { Dropdown } from "flowbite-react";
import { HiDotsVertical } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * The row furniture both lists on this page share, kept identical to the rows in
 * Settings › Credentials so the two screens read as one family: a bordered card,
 * a leading glyph, two-line blocks, and a kebab for the actions.
 */

/** Secondary line of every block: same size, same grey. */
export const SUBLINE = "truncate text-xs text-gray-500 dark:text-gray-400";

export const ROW =
  "relative flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition focus-within:ring-2 focus-within:ring-blue-500 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700";

/**
 * Stretches a real button's hit area across the whole row, so Enter/Space and
 * assistive tech come for free. The row can't itself be a button — it contains the
 * kebab's button, which would be invalid nesting — so it uses an overlay instead.
 */
export const ROW_BUTTON =
  "cursor-pointer text-left after:absolute after:inset-0 after:rounded-lg focus:outline-none";

/** Stands in for the credential list's provider logo: these rows have no artwork. */
export function RowIcon({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
      {children}
    </span>
  );
}

/**
 * Positioned by its caller, so it stacks above the row-wide overlay and stays
 * clickable — the menu is a sibling of the row's button, never a child of it.
 */
export function RowMenu({
  children,
  dict,
}: Readonly<{ children: React.ReactNode; dict: I18nRecord }>) {
  return (
    <Dropdown
      inline
      arrowIcon={false}
      label=""
      placement="bottom-end"
      className="w-44"
      renderTrigger={() => (
        <button
          type="button"
          aria-label={tr("menu.label", dict)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        >
          <HiDotsVertical className="h-4 w-4" />
        </button>
      )}
    >
      {children}
    </Dropdown>
  );
}

export function EmptyRow({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {message}
    </div>
  );
}
