"use client";

import { Dropdown } from "flowbite-react";
import { HiDotsVertical } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/** The card and menu both lists on this page share, the same as the credential cards. */

/** Secondary line of every block: same size, same grey. */
export const SUBLINE = "truncate text-xs text-gray-500 dark:text-gray-400";

export const CARD =
  "relative flex flex-col rounded-lg border border-gray-200 bg-white transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500";

/** A real button stretched over the card, so the kebab beside it stays a valid, clickable sibling. */
export const CARD_BUTTON =
  "block w-full cursor-pointer truncate text-left font-semibold text-gray-900 after:absolute after:inset-0 after:rounded-lg focus:outline-none dark:text-white";

/**
 * Positioned by its caller, so it stacks above the card-wide overlay and stays
 * clickable — the menu is a sibling of the card's button, never a child of it.
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
