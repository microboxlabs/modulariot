"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { HiCalendar, HiClock, HiSearch } from "react-icons/hi";

// Types
interface TimeRange {
  from: Date;
  to: Date;
  label?: string;
}

interface QuickRange {
  label: string;
  getValue: () => TimeRange;
}

interface TimeRangePickerProps {
  label?: string;
  onDateChange: (startDate: string, endDate: string) => void;
  format?: string;
  className?: string;
  mode?: "date" | "datetime";
  ranges?: "date" | "time";
}

// Date helpers
const subMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() - minutes);
  return result;
};

const subHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() - hours);
  return result;
};

const subDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const startOfMonth = (date: Date): Date => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfMonth = (date: Date): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
};

const getPreviousMonth = (date: Date): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - 1);
  return result;
};

const formatDate = (
  date: Date,
  format: string = "YYYY-MM-DD HH:mm"
): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  let formatted = format
    .replace("YYYY", year.toString())
    .replace("MM", month)
    .replace("DD", day);

  if (
    format.includes("HH") ||
    format.includes("mm") ||
    format.includes("ss")
  ) {
    formatted = formatted
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds);
  }

  return formatted;
};

const TIME_QUICK_RANGES: QuickRange[] = [
  {
    label: "Últimos 5 minutos",
    getValue: () => ({ from: subMinutes(new Date(), 5), to: new Date() }),
  },
  {
    label: "Últimos 15 minutos",
    getValue: () => ({ from: subMinutes(new Date(), 15), to: new Date() }),
  },
  {
    label: "Últimos 30 minutos",
    getValue: () => ({ from: subMinutes(new Date(), 30), to: new Date() }),
  },
  {
    label: "Última hora",
    getValue: () => ({ from: subHours(new Date(), 1), to: new Date() }),
  },
  {
    label: "Últimas 3 horas",
    getValue: () => ({ from: subHours(new Date(), 3), to: new Date() }),
  },
  {
    label: "Últimas 6 horas",
    getValue: () => ({ from: subHours(new Date(), 6), to: new Date() }),
  },
  {
    label: "Últimas 12 horas",
    getValue: () => ({ from: subHours(new Date(), 12), to: new Date() }),
  },
];

const DATE_QUICK_RANGES: QuickRange[] = [
  {
    label: "Hoy",
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
      label: "Hoy",
    }),
  },
  {
    label: "Ayer",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
      label: "Ayer",
    }),
  },
  {
    label: "Últimos 7 días",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 7)),
      to: endOfDay(new Date()),
      label: "Últimos 7 días",
    }),
  },
  {
    label: "Últimos 14 días",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 14)),
      to: endOfDay(new Date()),
      label: "Últimos 14 días",
    }),
  },
  {
    label: "Últimos 30 días",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date()),
      label: "Últimos 30 días",
    }),
  },
  {
    label: "Último mes (cerrado)",
    getValue: () => {
      const now = new Date();
      const prevMonth = getPreviousMonth(now);
      return {
        from: startOfMonth(prevMonth),
        to: endOfMonth(prevMonth),
        label: "Último mes (cerrado)",
      };
    },
  },
  {
    label: "Mes móvil",
    getValue: () => {
      const now = new Date();
      return {
        from: startOfDay(subDays(now, 30)),
        to: endOfDay(now),
        label: "Mes móvil",
      };
    },
  },
];

const RECENT_RANGES_KEY = "time-range-picker-recent";
const MAX_RECENT_RANGES = 5;

export default function TimeRangePicker({
  onDateChange,
  format = "YYYY-MM-DD HH:mm",
  className = "",
  mode = "datetime",
  ranges = "time",
}: TimeRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentRanges, setRecentRanges] = useState<
    Array<{ from: string; to: string; label?: string }>
  >([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_RANGES_KEY);
      if (saved) {
        setRecentRanges(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load recent ranges:", e);
    }
  }, []);

  const quickRanges = ranges === "date" ? DATE_QUICK_RANGES : TIME_QUICK_RANGES;

  const filteredQuickRanges = useMemo(() => {
    if (!searchQuery) return quickRanges;
    const query = searchQuery.toLowerCase();
    return quickRanges.filter((range) =>
      range.label.toLowerCase().includes(query)
    );
  }, [searchQuery, quickRanges]);

  const dateFormat = mode === "date" ? "YYYY-MM-DD" : format;

  const saveRecentRange = (from: string, to: string, label?: string) => {
    const newRange = { from, to, label };
    const filtered = recentRanges.filter(
      (r) => r.from !== from || r.to !== to
    );
    const updated = [newRange, ...filtered].slice(0, MAX_RECENT_RANGES);
    setRecentRanges(updated);
    try {
      localStorage.setItem(RECENT_RANGES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save recent ranges:", e);
    }
  };

  const handleApply = () => {
    if (fromDate && toDate) {
      onDateChange(fromDate, toDate);
      saveRecentRange(fromDate, toDate);
      setIsOpen(false);
    }
  };

  const formatRecentRange = (dateStr: string): string => {
    if (mode === "date") {
      return dateStr.split(" ")[0] || dateStr.split("T")[0] || dateStr;
    }
    return dateStr;
  };

  const handleQuickRangeSelect = (quickRange: QuickRange) => {
    const range = quickRange.getValue();
    const fromStr = formatDate(range.from, dateFormat);
    const toStr = formatDate(range.to, dateFormat);
    setFromDate(fromStr);
    setToDate(toStr);
    onDateChange(fromStr, toStr);
    saveRecentRange(fromStr, toStr, quickRange.label);
    setIsOpen(false);
  };

  const handleRecentRangeSelect = (range: {
    from: string;
    to: string;
    label?: string;
  }) => {
    const fromFormatted =
      mode === "date" ? formatRecentRange(range.from) : range.from;
    const toFormatted =
      mode === "date" ? formatRecentRange(range.to) : range.to;
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

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Trigger Button */}
      <div
        ref={buttonRef}
        onClick={handleToggle}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-sm transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
        title={
          fromDate && toDate
            ? `${fromDate} - ${toDate}`
            : "Seleccionar rango de fechas"
        }
      >
        <HiCalendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </div>

      {/* Dropdown Panel */}
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="z-[9999] flex rounded-lg border border-gray-200 bg-white text-gray-700 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: "600px",
              maxWidth: "calc(100vw - 32px)",
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Left Panel - Absolute Range */}
            <div className="flex-1 border-r border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                {mode === "date"
                  ? "Rango de fechas absoluto"
                  : "Rango de tiempo absoluto"}
              </h3>

              {/* From Date */}
              <div className="mb-4">
                <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                  Desde
                </label>
                <input
                  type={mode === "date" ? "date" : "datetime-local"}
                  value={
                    fromDate
                      ? mode === "date"
                        ? (fromDate.split(" ")[0] ||
                          fromDate.split("T")[0] ||
                          fromDate)
                        : fromDate.replace(" ", "T")
                      : ""
                  }
                  onChange={(e) => {
                    if (mode === "date") {
                      setFromDate(e.target.value);
                    } else {
                      setFromDate(e.target.value.replace("T", " "));
                    }
                  }}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>

              {/* To Date */}
              <div className="mb-4">
                <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                  Hasta
                </label>
                <input
                  type={mode === "date" ? "date" : "datetime-local"}
                  value={
                    toDate
                      ? mode === "date"
                        ? (toDate.split(" ")[0] ||
                          toDate.split("T")[0] ||
                          toDate)
                        : toDate.replace(" ", "T")
                      : ""
                  }
                  onChange={(e) => {
                    if (mode === "date") {
                      setToDate(e.target.value);
                    } else {
                      setToDate(e.target.value.replace("T", " "));
                    }
                  }}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>

              {/* Apply */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={handleApply}
                  disabled={!fromDate || !toDate}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  Aplicar rango
                </button>
              </div>

              {/* Recent Ranges */}
              {recentRanges.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                    Rangos recientes
                  </h4>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {recentRanges.map((range, index) => (
                      <div
                        key={index}
                        onClick={() => handleRecentRangeSelect(range)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="cursor-pointer truncate rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                      >
                        {range.label ||
                          `${formatRecentRange(range.from)} - ${formatRecentRange(range.to)}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timezone */}
              {mode === "datetime" && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <HiClock className="h-3 w-3" />
                    <span>Zona horaria: {timezone}</span>
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
                  placeholder="Buscar rangos"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto">
                {filteredQuickRanges.map((range, index) => (
                  <div
                    key={index}
                    onClick={() => handleQuickRangeSelect(range)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="cursor-pointer rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {range.label}
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
