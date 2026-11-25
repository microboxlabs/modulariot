"use client";

import { HiCheck } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

/** A small checkbox; "mixed" draws a dash, for a partial select-all. */
export default function SelectBox({
  checked,
  label,
  onToggle,
}: Readonly<{
  checked: boolean | "mixed";
  label: string;
  onToggle: () => void;
}>) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(event) => {
        // Selecting must not also open, expand or drag what holds it.
        event.stopPropagation();
        onToggle();
      }}
      className={twMerge(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
          : "border-gray-400 bg-white hover:border-blue-500 dark:border-gray-500 dark:bg-gray-800"
      )}
    >
      {checked === true && <HiCheck className="h-3 w-3" />}
      {checked === "mixed" && <span className="h-0.5 w-2 rounded bg-white" />}
    </button>
  );
}
