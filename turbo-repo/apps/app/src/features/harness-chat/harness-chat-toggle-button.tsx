"use client";

import { useEffect, useState } from "react";
import { BsStars } from "react-icons/bs";
import { twMerge } from "tailwind-merge";
import { useHarnessChatContext } from "./context/harness-chat-context";

/** Tracks whether ⌘/Ctrl is currently held down, for the shortcut hint. */
function useModifierHeld() {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) setHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) setHeld(false);
    };
    // Cmd+Tab away (or any focus loss) can eat the keyup — reset on blur too.
    const onBlur = () => setHeld(false);

    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("keyup", onKeyUp);
    globalThis.addEventListener("blur", onBlur);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("keyup", onKeyUp);
      globalThis.removeEventListener("blur", onBlur);
    };
  }, []);

  return held;
}

export default function HarnessChatToggleButton() {
  const { isOpen, toggle } = useHarnessChatContext();
  const modifierHeld = useModifierHeld();

  // ⌘/Ctrl+C toggles the panel. Deliberately no preventDefault — the OS/browser
  // copy command still runs as normal; this just also opens the panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") toggle();
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isOpen}
      className={twMerge(
        "h-10 w-10 select-none cursor-pointer relative flex items-center justify-center p-2 rounded-lg border border-transparent transition-all duration-300 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600",
        isOpen
          ? "bg-orange-50 dark:bg-orange-900/30 hover:border-orange-300 dark:hover:border-orange-700"
          : "bg-gray-100 dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      )}
    >
      <span className="sr-only">Toggle harness chat</span>
      <BsStars
        className={twMerge(
          "h-5 w-5",
          isOpen
            ? "text-orange-500 dark:text-orange-400"
            : "text-gray-500 dark:text-gray-400"
        )}
      />
      {modifierHeld && (
        <kbd className="absolute -bottom-1 -right-1 inline-flex items-center justify-center gap-0.5 rounded border border-gray-200 bg-white px-1 font-mono text-[9px] font-medium leading-tight text-gray-500 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          ⌘ + C
        </kbd>
      )}
    </button>
  );
}
