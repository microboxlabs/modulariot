"use client";

import { useState, useRef } from "react";
import { HiChevronDown, HiXMark } from "react-icons/hi2";
import type { DashboardFilterParam } from "../../types/dashboard.types";
import { useOutsideClick } from "./use-outside-click";
import { BADGE_ACTIVE, BADGE_IDLE, BADGE_BASE } from "./badge-styles";

interface SelectFilterBadgeProps {
  filter: DashboardFilterParam;
  values: string[];
  onApply: (values: string[]) => void;
  onClear: () => void;
}

export function SelectFilterBadge({ filter, values, onApply, onClear }: SelectFilterBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasValue = values.length > 0;

  useOutsideClick(containerRef, () => setOpen(false), open);

  const displayLabel = hasValue
    ? values.map((v) => filter.options?.find((o) => o.value === v)?.label ?? v).join(", ")
    : null;

  const toggleOption = (value: string) => {
    if (values.includes(value)) {
      const next = values.filter((v) => v !== value);
      if (next.length === 0) onClear();
      else onApply(next);
    } else {
      onApply([...values, value]);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`${BADGE_BASE} ${hasValue ? BADGE_ACTIVE : BADGE_IDLE}`}
      >
        <span>{hasValue ? `${filter.label}:` : filter.label}</span>
        {hasValue ? (
          <>
            <span className="max-w-28 truncate font-normal">{displayLabel}</span>
            <span
              role="button"
              tabIndex={0}
              onMouseDown={(e) => { e.stopPropagation(); onClear(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onClear(); }
              }}
              className="ml-0.5 shrink-0 cursor-pointer rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              <HiXMark className="h-3 w-3" />
            </span>
          </>
        ) : (
          <HiChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onClear();
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-600 ${
              !hasValue
                ? "font-semibold text-blue-600 dark:text-blue-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            All
          </button>
          <div className="my-0.5 border-t border-gray-100 dark:border-gray-600" />
          {(filter.options ?? []).map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleOption(opt.value);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                    checked
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-700"
                  }`}
                >
                  {checked && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
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
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
