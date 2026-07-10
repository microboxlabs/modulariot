"use client";

import { twMerge } from "tailwind-merge";

type BadgeMultiSelectGroupProps = Readonly<{
  options: readonly string[];
  value?: readonly string[];
  onChange: (value: string[]) => void;
  /** Accessible name for the group, e.g. "What do you want to monitor?" */
  name: string;
}>;

/** Multi-select group of pill/badge buttons, wrapping onto multiple lines. */
export default function BadgeMultiSelectGroup({
  options,
  value,
  onChange,
  name,
}: BadgeMultiSelectGroupProps) {
  const selectedValues = value ?? [];

  function toggle(option: string) {
    onChange(
      selectedValues.includes(option)
        ? selectedValues.filter((v) => v !== option)
        : [...selectedValues, option]
    );
  }

  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedValues.includes(option);
        return (
          <button
            key={option}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => toggle(option)}
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
