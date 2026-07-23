"use client";

import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import {
  BADGE_ACTIVE,
  BADGE_BASE,
  BADGE_IDLE,
} from "@/features/dashboard/components/dashboard-filters-card/badge-styles";

interface FilterSearchFieldProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  /** Accessible name; falls back to the placeholder. */
  readonly label?: string;
  readonly className?: string;
}

/**
 * Search input styled as a filter badge.
 *
 * A stock form input next to the pill-shaped filter badges reads as a different
 * design language — taller, square, heavier border. This borrows the badges'
 * own tokens ({@link BADGE_BASE}, idle/active) so the whole row is one family:
 * idle while empty, blue once it carries a term, with the same inline clear.
 */
export function FilterSearchField({
  id,
  value,
  onChange,
  placeholder,
  label,
  className = "w-72 max-w-full",
}: FilterSearchFieldProps) {
  const hasValue = value !== "";

  return (
    <div
      className={`${BADGE_BASE} ${hasValue ? BADGE_ACTIVE : BADGE_IDLE} ${className} cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500`}
    >
      <HiMagnifyingGlass className="h-3 w-3 shrink-0 opacity-50" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        // The pill draws the chrome, so the input itself is bare — and the
        // native search decorations are hidden to keep the clear affordance
        // consistent with the badges'.
        className="w-full min-w-0 bg-transparent font-normal placeholder-gray-400 focus:outline-none dark:placeholder-gray-500 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`${label ?? placeholder}: clear`}
          className="shrink-0 cursor-pointer rounded-full p-0.5 text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          <HiXMark className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
