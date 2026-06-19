"use client";

import { useState, useRef, useEffect } from "react";
import { HiChevronDown, HiXMark } from "react-icons/hi2";
import type { DashboardFilterParam } from "../../types/dashboard.types";
import { useOutsideClick } from "./use-outside-click";
import { BADGE_ACTIVE, BADGE_IDLE, BADGE_BASE } from "./badge-styles";

interface TextFilterBadgeProps {
  filter: DashboardFilterParam;
  value: string | undefined;
  onApply: (v: string) => void;
  onClear: () => void;
}

export function TextFilterBadge({ filter, value, onApply, onClear }: Readonly<TextFilterBadgeProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [chips, setChips] = useState<string[]>(() =>
    value ? value.split(",").filter(Boolean) : []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChips(value ? value.split(",").filter(Boolean) : []);
  }, [value]);

  const hasValue = chips.length > 0;

  useEffect(() => {
    if (open) {
      setDraft("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useOutsideClick(containerRef, () => setOpen(false), open);

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
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`${BADGE_BASE} ${hasValue ? BADGE_ACTIVE : BADGE_IDLE}`}
      >
        <span>{hasValue ? `${filter.label}:` : filter.label}</span>
        {hasValue ? (
          <>
            <span className="max-w-32 truncate font-normal">{chips.join(", ")}</span>
            <span className="w-3.5" aria-hidden />
          </>
        ) : (
          <HiChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {hasValue && (
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); handleClear(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleClear(); }
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 shrink-0 cursor-pointer rounded-full p-0.5 text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          <HiXMark className="h-3 w-3" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-700">
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
              if (e.key === "Enter") {
                e.preventDefault();
                addChip();
              } else if (e.key === "Escape") {
                inputRef.current?.blur();
              }
            }}
            onBlur={(e) => {
              const related = e.relatedTarget as Node | null;
              if (!containerRef.current?.contains(related)) {
                setOpen(false);
              }
            }}
            placeholder="Add value, press Enter…"
            className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400"
          />
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            Enter to add · Esc to close
          </p>
        </div>
      )}
    </div>
  );
}
