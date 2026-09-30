"use client";

import { useEffect, useRef, useState } from "react";

/** A filter as a chip: shows "Label: value" when set, opens a list of options, × clears. */
export function FilterChip({
  label,
  value,
  options,
  allLabel,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          value
            ? "border-blue-300 bg-blue-50 pr-7 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
            : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        <span>{value ? `${label}: ${value}` : label}</span>
        {!value && (
          <svg
            aria-hidden
            className={`h-3 w-3 opacity-50 transition ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>
      {value && (
        <button
          type="button"
          aria-label={allLabel}
          onClick={() => onChange("")}
          className="absolute right-2 top-1 text-xs text-blue-500"
        >
          ×
        </button>
      )}
      {open && (
        <div className="absolute z-40 mt-1 min-w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
          <button
            type="button"
            onClick={() => pick("")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-600"
          >
            {allLabel}
          </button>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(o)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <span
                className={`h-3.5 w-3.5 rounded-full border ${
                  value === o
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300 dark:border-gray-500"
                }`}
              />
              <span>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
