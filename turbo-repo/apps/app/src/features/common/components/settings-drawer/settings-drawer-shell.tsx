"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { HiX } from "react-icons/hi";

export interface SettingsDrawerShellProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly subtitle?: string;
  /** aria-label for the overlay and the close button. */
  readonly closeLabel: string;
  /** Optional badge to the left of the title (e.g. a section icon). */
  readonly icon?: ReactNode;
  /** Body and footer — the shell owns chrome and motion, nothing else. */
  readonly children: ReactNode;
}

/**
 * THE right-side settings drawer: portal, dimmed overlay, 300ms slide, and the
 * icon/title/close header. One shell behind every settings sidebar — the
 * kanban's review channels and the calendar's advanced settings alike — so the
 * open/close behaviour and chrome cannot drift between surfaces.
 *
 * Stays mounted while hidden (visibility + transform transitions need the DOM
 * node to animate); callers gate expensive content on `show` themselves, which
 * both existing consumers already do.
 */
export function SettingsDrawerShell({
  show,
  onClose,
  title,
  subtitle,
  closeLabel,
  icon,
  children,
}: Readonly<SettingsDrawerShellProps>) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[800] transition-all duration-300 ${
        show ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/20 transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        aria-label={title}
        className={`absolute right-0 top-0 flex h-full w-[30rem] max-w-full flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800 ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                {icon}
              </span>
            )}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <HiX className="h-5 w-5" />
          </button>
        </div>

        {children}
      </aside>
    </div>,
    document.body
  );
}
