"use client";

import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface SettingsTabButtonProps {
  /** Whether this tab is currently active */
  active: boolean;
  /** Click handler */
  onClick: () => void;
  /** Tab label content */
  children: ReactNode;
}

/**
 * A reusable tab button for settings modals.
 * Provides consistent styling with proper dark mode hover states.
 */
export function SettingsTabButton({
  active,
  onClick,
  children,
}: Readonly<SettingsTabButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
        active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      )}
    >
      {children}
    </button>
  );
}
