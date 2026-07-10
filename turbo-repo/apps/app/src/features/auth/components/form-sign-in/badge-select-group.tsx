"use client";

import { twMerge } from "tailwind-merge";

type BadgeSelectGroupProps = Readonly<{
  options: readonly string[];
  value?: string;
  onChange: (value: string) => void;
  /** Accessible name for the radiogroup, e.g. "Organization size" */
  name: string;
}>;

/** Single-select group of pill/badge buttons, wrapping onto multiple lines. */
export default function BadgeSelectGroup({
  options,
  value,
  onChange,
  name,
}: BadgeSelectGroupProps) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={twMerge(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              selected
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:bg-gray-700"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
