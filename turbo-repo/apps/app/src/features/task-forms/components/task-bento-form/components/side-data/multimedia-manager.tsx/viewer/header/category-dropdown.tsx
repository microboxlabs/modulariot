"use client";

import { useState, useEffect, useRef } from "react";
import { HiChevronDown, HiCheck } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export function CategoryDropdown({
  categories,
  currentTag,
  onCategoryChange,
  dictionary,
  fullWidth = false,
}: Readonly<{
  categories: { value: string; label: string }[];
  currentTag: string | null;
  onCategoryChange: (category: string) => void;
  dictionary: I18nRecord;
  fullWidth?: boolean;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = categories.find((c) => c.value === currentTag) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : "shrink min-w-0 sm:shrink-0"}`}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold rounded-lg border px-2 sm:px-3 py-1 sm:py-1.5 transition-all duration-150 cursor-pointer ${fullWidth ? "w-full" : "max-w-full"} ${
          current
            ? "text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            : "text-gray-500 dark:text-gray-400 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
        }`}
      >
        <span className="truncate flex-1 text-left">
          {current?.label ?? tr("bento.multimedia.select_document_type", dictionary)}
        </span>
        <HiChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-max rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
          <div className="p-1 flex flex-col gap-0.5">
            {categories.map((cat) => {
              const isSelected = cat.value === currentTag;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => { onCategoryChange(cat.value); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="flex-1">{cat.label}</span>
                  {isSelected && <HiCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
