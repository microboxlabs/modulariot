"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { HiCalendar, HiClock, HiSearch, HiChevronDown } from "react-icons/hi";
import dayjs from "dayjs";
import { z } from "zod";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const recentRangeSchema = z.array(
  z.object({
    from: z.string(),
    to: z.string(),
    labelKey: z.string().optional(),
  })
);

interface QuickRangeDef {
  labelKey: string;
  getValue: () => { from: dayjs.Dayjs; to: dayjs.Dayjs };
}

interface TimeRangePickerProps {
  onDateChange: (startDate: string, endDate: string) => void;
  dictionary: I18nRecord;
  from?: string;
  to?: string;
  format?: string;
  className?: string;
  mode?: "date" | "datetime";
  ranges?: "date" | "time";
  size?: "sm" | "md";
  fullWidth?: boolean;
}

const T_PREFIX = "dashboard.filterBar";

const TIME_QUICK_RANGES: QuickRangeDef[] = [
  { labelKey: "last5Minutes", getValue: () => ({ from: dayjs().subtract(5, "minute"), to: dayjs() }) },
  { labelKey: "last15Minutes", getValue: () => ({ from: dayjs().subtract(15, "minute"), to: dayjs() }) },
  { labelKey: "last30Minutes", getValue: () => ({ from: dayjs().subtract(30, "minute"), to: dayjs() }) },
  { labelKey: "lastHour", getValue: () => ({ from: dayjs().subtract(1, "hour"), to: dayjs() }) },
  { labelKey: "last3Hours", getValue: () => ({ from: dayjs().subtract(3, "hour"), to: dayjs() }) },
  { labelKey: "last6Hours", getValue: () => ({ from: dayjs().subtract(6, "hour"), to: dayjs() }) },
  { labelKey: "last12Hours", getValue: () => ({ from: dayjs().subtract(12, "hour"), to: dayjs() }) },
];

const DATE_QUICK_RANGES: QuickRangeDef[] = [
  { labelKey: "today", getValue: () => ({ from: dayjs().startOf("day"), to: dayjs().endOf("day") }) },
  { labelKey: "yesterday", getValue: () => ({ from: dayjs().subtract(1, "day").startOf("day"), to: dayjs().subtract(1, "day").endOf("day") }) },
  { labelKey: "last7Days", getValue: () => ({ from: dayjs().subtract(7, "day").startOf("day"), to: dayjs().endOf("day") }) },
  { labelKey: "last14Days", getValue: () => ({ from: dayjs().subtract(14, "day").startOf("day"), to: dayjs().endOf("day") }) },
  { labelKey: "last30Days", getValue: () => ({ from: dayjs().subtract(30, "day").startOf("day"), to: dayjs().endOf("day") }) },
  { labelKey: "lastMonthClosed", getValue: () => ({ from: dayjs().subtract(1, "month").startOf("month"), to: dayjs().subtract(1, "month").endOf("month") }) },
  { labelKey: "rollingMonth", getValue: () => ({ from: dayjs().subtract(30, "day").startOf("day"), to: dayjs().endOf("day") }) },
];

const RECENT_RANGES_KEY = "time-range-picker-recent";
const MAX_RECENT_RANGES = 5;

export default function TimeRangePicker({
  onDateChange,
  dictionary,
  from: externalFrom,
  to: externalTo,
  format = "YYYY-MM-DD HH:mm",
  className = "",
  mode = "datetime",
  ranges = "time",
  size = "md",
  fullWidth = false,
}: Readonly<TimeRangePickerProps>) {
  const t = (key: string) => tr(`${T_PREFIX}.${key}`, dictionary);
  const storageKey = `${RECENT_RANGES_KEY}:${mode}`;

  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState<string>(externalFrom ?? "");
  const [toDate, setToDate] = useState<string>(externalTo ?? "");

  useEffect(() => {
    setFromDate(externalFrom ?? "");
  }, [externalFrom]);

  useEffect(() => {
    setToDate(externalTo ?? "");
  }, [externalTo]);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentRanges, setRecentRanges] = useState<
    Array<{ from: string; to: string; labelKey?: string }>
  >([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = recentRangeSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          setRecentRanges(parsed.data);
        }
      }
    } catch {
      // Corrupted localStorage — ignore
    }
  }, [storageKey]);

  const quickRangeDefs = ranges === "date" ? DATE_QUICK_RANGES : TIME_QUICK_RANGES;

  const resolvedRanges = useMemo(
    () => quickRangeDefs.map((r) => ({ ...r, label: t(r.labelKey) })),
    [quickRangeDefs, dictionary]
  );

  const filteredQuickRanges = useMemo(() => {
    if (!searchQuery) return resolvedRanges;
    const query = searchQuery.toLowerCase();
    return resolvedRanges.filter((range) =>
      range.label.toLowerCase().includes(query)
    );
  }, [searchQuery, resolvedRanges]);

  const dateFormat = mode === "date" ? "YYYY-MM-DD" : format;

  const saveRecentRange = (from: string, to: string, labelKey?: string) => {
    const newRange = { from, to, labelKey };
    const filtered = recentRanges.filter(
      (r) => r.from !== from || r.to !== to
    );
    const updated = [newRange, ...filtered].slice(0, MAX_RECENT_RANGES);
    setRecentRanges(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save recent ranges:", e);
    }
  };

  const isValidRange = fromDate !== "" && toDate !== "" && fromDate <= toDate;

  const handleApply = () => {
    if (isValidRange) {
      onDateChange(fromDate, toDate);
      saveRecentRange(fromDate, toDate);
      setIsOpen(false);
    }
  };

  const extractDatePart = (dateStr: string): string =>
    dateStr.split(" ")[0] || dateStr.split("T")[0] || dateStr;

  const getInputValue = (dateStr: string): string => {
    if (!dateStr) return "";
    if (mode === "date") return extractDatePart(dateStr);
    return dateStr.replace(" ", "T");
  };

  const handleQuickRangeSelect = (range: (typeof resolvedRanges)[number]) => {
    const value = range.getValue();
    const fromStr = value.from.format(dateFormat);
    const toStr = value.to.format(dateFormat);
    setFromDate(fromStr);
    setToDate(toStr);
    onDateChange(fromStr, toStr);
    saveRecentRange(fromStr, toStr, range.labelKey);
    setIsOpen(false);
  };

  const handleRecentRangeSelect = (range: {
    from: string;
    to: string;
    labelKey?: string;
  }) => {
    const fromFormatted = mode === "date" ? extractDatePart(range.from) : range.from;
    const toFormatted = mode === "date" ? extractDatePart(range.to) : range.to;
    setFromDate(fromFormatted);
    setToDate(toFormatted);
    onDateChange(fromFormatted, toFormatted);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Prevent keydown events inside the panel from bubbling to parent components
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isOpen) return;
    const stop = (e: KeyboardEvent) => e.stopPropagation();
    panel.addEventListener("keydown", stop);
    return () => panel.removeEventListener("keydown", stop);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 600;
      const margin = 16;

      let leftPos = rect.left;
      if (rect.left + dropdownWidth > window.innerWidth - margin) {
        leftPos = rect.right - dropdownWidth;
        if (leftPos < margin) {
          leftPos = margin;
        }
      }

      setPosition({
        top: rect.bottom + 8,
        left: leftPos,
      });
    }
    setIsOpen(!isOpen);
  };

  const timezone = useMemo(() => {
    const offset = new Date().getTimezoneOffset();
    const hours = Math.abs(Math.floor(offset / 60));
    const minutes = Math.abs(offset % 60);
    const sign = offset <= 0 ? "+" : "-";
    return `UTC${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }, []);

  let sizeClass: string;
  if (fullWidth) {
    sizeClass = "h-7 w-full justify-between gap-1.5 rounded px-2";
  } else if (size === "sm") {
    sizeClass = "h-8 w-8 justify-center rounded-md";
  } else {
    sizeClass = "h-10.5 w-10.5 justify-center rounded-lg";
  }

  return (
    <div className={`relative flex items-center ${fullWidth ? "w-full" : ""} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex cursor-pointer items-center border border-gray-300 bg-white text-sm transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 ${sizeClass}`}
        title={
          fromDate && toDate
            ? `${fromDate} - ${toDate}`
            : t("selectDateRange")
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <HiCalendar className={`shrink-0 text-gray-500 dark:text-gray-400 ${fullWidth ? "h-3.5 w-3.5" : "h-5 w-5"}`} />
          {fullWidth && (
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {fromDate && toDate ? `${fromDate} – ${toDate}` : t("selectDateRange")}
            </span>
          )}
        </span>
        {fullWidth && <HiChevronDown className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />}
      </button>

      {isOpen &&
        createPortal(
          <dialog
            ref={panelRef}
            open
            className="z-[9999] flex rounded-lg border border-gray-200 bg-white text-gray-700 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: "600px",
              maxWidth: "calc(100vw - 32px)",
            }}
          >
            {/* Left Panel - Absolute Range */}
            <div className="flex-1 border-r border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                {mode === "date"
                  ? t("absoluteDateRange")
                  : t("absoluteTimeRange")}
              </h3>

              {([
                { labelKey: "from" as const, value: fromDate, setter: setFromDate },
                { labelKey: "to" as const, value: toDate, setter: setToDate },
              ]).map(({ labelKey, value, setter }) => (
                <div key={labelKey} className="mb-4">
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                    {t(labelKey)}
                  </label>
                  <input
                    type={mode === "date" ? "date" : "datetime-local"}
                    value={getInputValue(value)}
                    onChange={(e) => {
                      setter(
                        mode === "date"
                          ? e.target.value
                          : e.target.value.replace("T", " ")
                      );
                    }}
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 scheme-light dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:scheme-dark"
                  />
                </div>
              ))}

              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!isValidRange}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  {t("applyRange")}
                </button>
              </div>

              {recentRanges.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                    {t("recentRanges")}
                  </h4>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {recentRanges.map((range) => (
                      <button
                        type="button"
                        key={`${range.from}-${range.to}`}
                        onClick={() => handleRecentRangeSelect(range)}
                        className="w-full cursor-pointer truncate rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                      >
                        {range.labelKey
                          ? t(range.labelKey)
                          : `${extractDatePart(range.from)} - ${extractDatePart(range.to)}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "datetime" && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <HiClock className="h-3 w-3" />
                    <span>{t("timezone")}: {timezone}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Quick Ranges */}
            <div className="w-48 p-4">
              <div className="relative mb-3">
                <HiSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  placeholder={t("searchRanges")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto">
                {filteredQuickRanges.map((range) => (
                  <button
                    type="button"
                    key={range.labelKey}
                    onClick={() => handleQuickRangeSelect(range)}
                    className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </dialog>,
          document.body
        )}
    </div>
  );
}
