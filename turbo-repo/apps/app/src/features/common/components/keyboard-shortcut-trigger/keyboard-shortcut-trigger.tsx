"use client";

import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { useKeyboardShortcut } from "@/features/common/hooks/use-keyboard-shortcut";

/**
 * Wraps an actionable element (typically a button) with a global keyboard
 * shortcut: holding the modifier reveals a small key-hint badge over the
 * element's corner, and pressing the shortcut fires `onTrigger` — mounted
 * on top of the element, so it doesn't need to know about the shortcut
 * itself and any actionable element can pick this up.
 */
export default function KeyboardShortcutTrigger({
  shortcutKey,
  label,
  onTrigger,
  withModifier = true,
  children,
}: Readonly<{
  shortcutKey: string;
  /** Text shown in the hint badge, e.g. "C". Defaults to the shortcut key, uppercased. */
  label?: string;
  onTrigger: () => void;
  withModifier?: boolean;
  children: ReactNode;
}>) {
  const { modifierHeld, justTriggered } = useKeyboardShortcut({
    key: shortcutKey,
    withModifier,
    onTrigger,
  });

  return (
    <div className="relative inline-flex">
      {children}
      {modifierHeld && (
        <kbd
          className={twMerge(
            "absolute -bottom-1 -right-1 inline-flex items-center justify-center gap-0.5 rounded border border-gray-200 bg-white px-1 font-mono text-[9px] font-medium leading-tight text-gray-500 shadow-sm transition-transform duration-150 ease-out dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400",
            justTriggered
              ? "scale-90 border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200"
              : "scale-100"
          )}
        >
          {label ?? shortcutKey.toUpperCase()}
        </kbd>
      )}
    </div>
  );
}
