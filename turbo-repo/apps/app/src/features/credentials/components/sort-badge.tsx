"use client";

import { useRef, useState } from "react";
import { FilterBadgeShell } from "@/features/dashboard/components/dashboard-filters-card/filter-badge-shell";
import { useOutsideClick } from "@/features/dashboard/components/dashboard-filters-card/use-outside-click";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";

export interface SortBadgeOption {
  readonly value: string;
  readonly label: string;
}

interface SortBadgeProps {
  readonly label: string;
  readonly value: string;
  /** Sort shown as "unset": the badge stays idle while this is selected. */
  readonly defaultValue: string;
  readonly options: readonly SortBadgeOption[];
  readonly onChange: (value: string) => void;
}

/**
 * Sort control built on the same badge shell as the global filters, so the
 * toolbar reads as one row of controls rather than a mix of badges and a
 * form select.
 *
 * Unlike a filter this is single-choice: picking an option replaces the
 * current one, and clearing returns to the default order rather than to
 * "no value".
 */
export function SortBadge({
  label,
  value,
  defaultValue,
  options,
  onChange,
}: SortBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useOutsideClick(containerRef, () => setOpen(false), open, panelRef);

  const isCustom = value !== defaultValue;
  const selected = options.find((option) => option.value === value);

  const filter: DashboardFilterParam = { key: "sort", label, type: "select" };

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <FilterBadgeShell
      filter={filter}
      hasValue={isCustom}
      displayValue={selected?.label ?? null}
      valueMaxWidth="max-w-32"
      open={open}
      onToggle={() => setOpen((previous) => !previous)}
      onClear={() => select(defaultValue)}
      panelClassName="min-w-56 py-1"
      containerRef={containerRef}
      panelRef={panelRef}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              select(option.value);
            }}
            className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-600 ${
              checked
                ? "font-semibold text-blue-600 dark:text-blue-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              {checked && (
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 5l2.5 2.5L8 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            {option.label}
          </button>
        );
      })}
    </FilterBadgeShell>
  );
}
