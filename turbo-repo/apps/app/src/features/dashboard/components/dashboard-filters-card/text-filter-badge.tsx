"use client";

import { useState, useRef, useEffect } from "react";
import { HiXMark } from "react-icons/hi2";
import type { DashboardFilterParam } from "../../types/dashboard.types";
import { useOutsideClick } from "./use-outside-click";
import { FilterBadgeShell } from "./filter-badge-shell";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

interface TextFilterBadgeProps {
  filter: DashboardFilterParam;
  value: string | undefined;
  onApply: (v: string) => void;
  onClear: () => void;
  dictionary: I18nRecord;
}

export function TextFilterBadge({ filter, value, onApply, onClear, dictionary }: Readonly<TextFilterBadgeProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [chips, setChips] = useState<string[]>(() =>
    value ? value.split(",").filter(Boolean) : []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setChips(value ? value.split(",").filter(Boolean) : []); }, [value]);

  useEffect(() => {
    if (open) {
      setDraft("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useOutsideClick(containerRef, () => setOpen(false), open);

  const hasValue = chips.length > 0;

  const addChip = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const next = [...chips, trimmed];
    setChips(next);
    onApply(next.join(","));
    setDraft("");
  };

  const handleClear = () => {
    setChips([]);
    onClear();
  };

  const removeChip = (chip: string) => {
    const next = chips.filter((c) => c !== chip);
    setChips(next);
    if (next.length === 0) onClear();
    else onApply(next.join(","));
  };

  return (
    <FilterBadgeShell
      filter={filter}
      hasValue={hasValue}
      displayValue={chips.join(", ")}
      open={open}
      onToggle={() => setOpen((p) => !p)}
      onClear={handleClear}
      panelClassName="w-64 p-2"
      containerRef={containerRef}
    >
      {chips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {chip}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); removeChip(chip); }}
                className="shrink-0 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                <HiXMark className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); addChip(); }
          else if (e.key === "Escape") { inputRef.current?.blur(); }
        }}
        onBlur={(e) => {
          const related = e.relatedTarget as Node | null;
          if (!containerRef.current?.contains(related)) setOpen(false);
        }}
        placeholder={tr("dashboard.settings.textFilterPlaceholder", dictionary)}
        className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400"
      />
      <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
        {tr("dashboard.settings.textFilterHint", dictionary)}
      </p>
    </FilterBadgeShell>
  );
}
