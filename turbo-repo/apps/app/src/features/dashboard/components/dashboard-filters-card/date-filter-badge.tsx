"use client";

import { useState, useEffect } from "react";
import { HiCalendar, HiChevronDown, HiXMark } from "react-icons/hi2";
import TimeRangePicker from "../dashboard-filter-bar/time-range-picker";
import type { DashboardFilterParam } from "../../types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { BADGE_ACTIVE, BADGE_IDLE } from "./badge-styles";

interface DateFilterBadgeProps {
  filter: DashboardFilterParam;
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string, to: string) => void;
  onClear: () => void;
  dictionary: I18nRecord;
}

export function DateFilterBadge({ filter, from, to, onChange, onClear, dictionary }: Readonly<DateFilterBadgeProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);

  const hasValue = Boolean(localFrom || localTo);
  const displayText = hasValue ? [localFrom, localTo].filter(Boolean).join(" – ") : null;

  const handleDateChange = (newFrom: string, newTo: string) => {
    setLocalFrom(newFrom);
    setLocalTo(newTo);
    onChange(newFrom, newTo);
  };

  const handleClear = () => {
    setLocalFrom(undefined);
    setLocalTo(undefined);
    onClear();
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Visual badge — pointer-events-none so the transparent picker on top receives clicks */}
      <span
        className={`pointer-events-none inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
          hasValue ? BADGE_ACTIVE : BADGE_IDLE
        }`}
      >
        <HiCalendar className="h-3 w-3 shrink-0" />
        <span>{displayText ? `${filter.label}:` : filter.label}</span>
        {displayText && <span className="font-normal">{displayText}</span>}
        {!hasValue && (
          <HiChevronDown
            className={`h-3 w-3 opacity-50 transition-transform duration-150 ${isPickerOpen ? "rotate-180" : ""}`}
          />
        )}
        {/* Reserve space for the X button */}
        {hasValue && <span className="w-4" aria-hidden />}
      </span>

      {/* Transparent TimeRangePicker laid on top — its button triggers the date picker panel */}
      <div
        className="absolute inset-0 overflow-hidden opacity-0"
        style={hasValue ? { right: 24 } : undefined}
      >
        <TimeRangePicker
          dictionary={dictionary}
          mode="date"
          ranges="date"
          fullWidth
          from={localFrom}
          to={localTo}
          onDateChange={handleDateChange}
          onOpenChange={setIsPickerOpen}
        />
      </div>

      {/* X button sits above the transparent picker (z-10) */}
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 z-10 shrink-0 rounded-full p-0.5 text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          <HiXMark className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
