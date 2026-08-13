"use client";

import { BsStars } from "react-icons/bs";
import { twMerge } from "tailwind-merge";
import { KeyboardShortcutTrigger } from "@/features/common/components/keyboard-shortcut-trigger";
import { useHarnessChatContext } from "./context/harness-chat-context";

export default function HarnessChatToggleButton() {
  const { isOpen, toggle } = useHarnessChatContext();

  return (
    // ⌘/Ctrl+C toggles the panel. Deliberately no preventDefault — the OS/browser
    // copy command still runs as normal; this just also opens the panel.
    <KeyboardShortcutTrigger shortcutKey="c" onTrigger={toggle}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isOpen}
        className={twMerge(
          "h-10 w-10 select-none cursor-pointer flex items-center justify-center p-2 rounded-lg border border-transparent transition-all duration-300 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600",
          isOpen
            ? "bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)] hover:brightness-105"
            : "bg-gray-100 dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        )}
      >
        <span className="sr-only">Toggle harness chat</span>
        <BsStars
          className={twMerge("h-5 w-5", isOpen ? "text-white" : "text-gray-500 dark:text-gray-400")}
        />
      </button>
    </KeyboardShortcutTrigger>
  );
}
