"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { HiCheck, HiChevronDown } from "react-icons/hi2";

export type MultiSelectOption = {
  value: string;
  /** Already resolved for display — the component does no i18n lookup of its own. */
  label: string;
  description?: string;
};

interface BrandedMultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  /** Shown when nothing is selected. */
  placeholder: string;
  /** Trigger text once more than one option is picked, e.g. "3 opciones seleccionadas". */
  summaryLabel: (count: number) => string;
  emptyLabel: string;
  /** "sm" fits the document viewer's sidebar; "md" is the modal's roomier form. */
  size?: "sm" | "md";
}

const SIZES = {
  sm: { trigger: "px-2.5 py-1.5 text-xs", option: "px-2.5 py-2", label: "text-xs", chevron: "w-3.5 h-3.5" },
  md: { trigger: "px-4 py-3 text-sm", option: "px-4 py-3", label: "text-sm", chevron: "w-5 h-5" },
} as const;

/**
 * Multi-select with checkbox rows, used wherever an operator picks any number of
 * codes from a catalog.
 *
 * <p>Selecting nothing is a valid state: the caller decides whether an empty
 * selection blocks its own submit. An earlier picker refused to drop its last
 * value, which forced the reviewer to add the option they wanted before removing
 * the one they didn't — the opposite of the order anyone reaches for.
 */
export default function BrandedMultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder,
  summaryLabel,
  emptyLabel,
  size = "md",
}: Readonly<BrandedMultiSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const s = SIZES[size];

  // Close on an outside click or Escape, like every other popover in the app.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const toggleOption = (value: string) => {
    onSelectionChange(
      selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value]
    );
  };

  const displayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      return options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0];
    }
    return summaryLabel(selectedValues.length);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`w-full flex justify-between items-center gap-2 rounded-lg border border-gray-300 bg-white text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 ${s.trigger}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectedValues.length > 0 && (
            <HiCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          )}
          <span
            className={`font-medium truncate ${
              selectedValues.length === 0
                ? "text-gray-500 dark:text-gray-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {displayText()}
          </span>
        </span>
        <HiChevronDown
          className={`${s.chevron} text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable
          className="absolute z-50 mt-2 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                className={`flex items-start gap-3 cursor-pointer border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-gray-600 dark:hover:bg-gray-600 dark:focus:bg-gray-600 ${s.option}`}
                onClick={() => toggleOption(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleOption(option.value);
                  }
                }}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // the row handles it
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 pointer-events-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-800"
                  tabIndex={-1}
                />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-gray-900 dark:text-gray-100 ${s.label}`}>
                    {option.label}
                  </p>
                  {option.description && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {options.length === 0 && (
            <div className={`text-center text-gray-500 dark:text-gray-400 ${s.option} ${s.label}`}>
              {emptyLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
