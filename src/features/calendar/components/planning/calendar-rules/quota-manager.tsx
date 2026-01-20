"use client";

import { Button, Select } from "flowbite-react";
import { useCallback, useMemo } from "react";
import { HiPlus, HiTrash, HiCheck, HiClock, HiCalendar } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { type TimeWindow, usePlanningSelection } from "../planning-selection-context";

/**
 * Time window configuration
 * Format output: W1-4 1-5 0900-1700
 * - W1-4: Weeks 1-4 of the month (W* for all weeks)
 * - 1-5: Days 1 (Monday) to 5 (Friday)
 * - 0900-1700: Time range in HHMM format
 */

const MIN_HOUR = 8;
const MAX_HOUR = 22;

// Days using format standard: 1=Monday, 7=Sunday
const DAYS_OF_WEEK = [
  { value: 1, label: "L", fullLabel: "Lunes" },
  { value: 2, label: "M", fullLabel: "Martes" },
  { value: 3, label: "X", fullLabel: "Miércoles" },
  { value: 4, label: "J", fullLabel: "Jueves" },
  { value: 5, label: "V", fullLabel: "Viernes" },
  { value: 6, label: "S", fullLabel: "Sábado" },
  { value: 7, label: "D", fullLabel: "Domingo" },
];

const WEEKS_OF_MONTH = [
  { value: 1, label: "S1", fullLabel: "Semana 1" },
  { value: 2, label: "S2", fullLabel: "Semana 2" },
  { value: 3, label: "S3", fullLabel: "Semana 3" },
  { value: 4, label: "S4", fullLabel: "Semana 4" },
  { value: 5, label: "S5", fullLabel: "Semana 5" },
];

function generateTimeOptions(
  minHour = MIN_HOUR,
  maxHour = MAX_HOUR
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = minHour; hour <= maxHour; hour++) {
    for (const minutes of [0, 30]) {
      if (hour === maxHour && minutes > 0) continue;
      const value = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      options.push({ value, label: value });
    }
  }
  return options;
}

function parseTime(timeStr: string): { hour: number; minutes: number } {
  const [hour, minutes] = timeStr.split(":").map(Number);
  return { hour, minutes };
}

function formatTime(hour: number, minutes: number): string {
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function formatTimeCompact(hour: number, minutes: number): string {
  return `${hour.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}`;
}

function timeToMinutes(hour: number, minutes: number): number {
  return hour * 60 + minutes;
}

/**
 * Formats days array into range string
 * e.g., [1,2,3,4,5] -> "1-5", [1,3,5] -> "1,3,5"
 */
function formatDaysRange(days: number[]): string {
  if (days.length === 0) return "";
  const sorted = [...days].sort((a, b) => a - b);

  // Check if it's a continuous range
  const isRange =
    sorted.length > 1 &&
    sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);

  if (isRange) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
  return sorted.join(",");
}

/**
 * Formats weeks array into range string
 * e.g., [1,2,3,4] -> "W*", [1,2] -> "W1-2", [1,3] -> "W1,3"
 */
function formatWeeksRange(weeks: number[]): string {
  if (weeks.length === 0 || weeks.length >= 4) return "W*";
  const sorted = [...weeks].sort((a, b) => a - b);

  const isRange =
    sorted.length > 1 &&
    sorted.every((w, i) => i === 0 || w === sorted[i - 1] + 1);

  if (isRange) {
    return `W${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
  return `W${sorted.join(",")}`;
}

/**
 * Generates the full format string for a time window
 * Format: W1-4 1-5 0900-1700
 */
function formatTimeWindowCode(window: TimeWindow): string {
  const weeksStr = formatWeeksRange(window.weeks);
  const daysStr = formatDaysRange(window.days);
  const startTime = formatTimeCompact(window.startHour, window.startMinutes);
  const endTime = formatTimeCompact(window.endHour, window.endMinutes);

  if (!daysStr) return "";
  return `${weeksStr} ${daysStr} ${startTime}-${endTime}`;
}

interface QuotaManagerProps {
  onRulesChange?: (windows: TimeWindow[], formatString: string) => void;
}

export default function QuotaManager({
  onRulesChange,
}: Readonly<QuotaManagerProps>) {
  const { timeWindows, setTimeWindows } = usePlanningSelection();
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // Generate the combined format string for all windows
  const formatString = useMemo(() => {
    return timeWindows
      .map((w) => formatTimeWindowCode(w))
      .filter(Boolean)
      .join(", ");
  }, [timeWindows]);

  const addTimeWindow = useCallback(() => {
    const newWindow: TimeWindow = {
      id: crypto.randomUUID(),
      name: "",
      startHour: 9,
      startMinutes: 0,
      endHour: 17,
      endMinutes: 0,
      days: [1, 2, 3, 4, 5], // Monday to Friday
      weeks: [], // All weeks by default
      quota: 1,
    };
    setTimeWindows([...timeWindows, newWindow]);
  }, [timeWindows, setTimeWindows]);

  const updateTimeWindowName = useCallback((id: string, name: string) => {
    setTimeWindows(
      timeWindows.map((w) => (w.id === id ? { ...w, name } : w))
    );
  }, [timeWindows, setTimeWindows]);

  const removeTimeWindow = useCallback((id: string) => {
    setTimeWindows(timeWindows.filter((w) => w.id !== id));
  }, [timeWindows, setTimeWindows]);

  const toggleDay = useCallback((id: string, day: number) => {
    setTimeWindows(
      timeWindows.map((w) => {
        if (w.id !== id) return w;
        const days = w.days.includes(day)
          ? w.days.filter((d) => d !== day)
          : [...w.days, day];
        return { ...w, days };
      })
    );
  }, [timeWindows, setTimeWindows]);

  const toggleAllDays = useCallback((id: string) => {
    setTimeWindows(
      timeWindows.map((w) => {
        if (w.id !== id) return w;
        const allDays = DAYS_OF_WEEK.map((d) => d.value);
        const hasAllDays = allDays.every((d) => w.days.includes(d));
        return { ...w, days: hasAllDays ? [] : allDays };
      })
    );
  }, [timeWindows, setTimeWindows]);

  const toggleWeek = useCallback((id: string, week: number) => {
    setTimeWindows(
      timeWindows.map((w) => {
        if (w.id !== id) return w;
        const weeks = w.weeks.includes(week)
          ? w.weeks.filter((wk) => wk !== week)
          : [...w.weeks, week];
        return { ...w, weeks };
      })
    );
  }, [timeWindows, setTimeWindows]);

  const toggleAllWeeks = useCallback((id: string) => {
    setTimeWindows(
      timeWindows.map((w) => {
        if (w.id !== id) return w;
        const hasAllWeeks = w.weeks.length === 0;
        return {
          ...w,
          weeks: hasAllWeeks ? [1, 2, 3, 4] : [],
        };
      })
    );
  }, [timeWindows, setTimeWindows]);

  const updateQuota = useCallback((id: string, quota: number) => {
    setTimeWindows(
      timeWindows.map((w) => (w.id === id ? { ...w, quota: Math.max(0, quota) } : w))
    );
  }, [timeWindows, setTimeWindows]);

  const updateTimeWindow = useCallback(
    (id: string, field: "start" | "end", timeStr: string) => {
      const { hour, minutes } = parseTime(timeStr);
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id) return w;

          if (field === "start") {
            const newStartMinutes = timeToMinutes(hour, minutes);
            const endMinutes = timeToMinutes(w.endHour, w.endMinutes);
            if (newStartMinutes >= endMinutes) {
              const adjustedEnd = newStartMinutes + 30;
              const newEndHour = Math.floor(adjustedEnd / 60);
              const newEndMinutes = adjustedEnd % 60;
              if (newEndHour > MAX_HOUR) {
                return {
                  ...w,
                  startHour: hour,
                  startMinutes: minutes,
                  endHour: MAX_HOUR,
                  endMinutes: 0,
                };
              }
              return {
                ...w,
                startHour: hour,
                startMinutes: minutes,
                endHour: newEndHour,
                endMinutes: newEndMinutes,
              };
            }
            return { ...w, startHour: hour, startMinutes: minutes };
          }

          const startMinutes = timeToMinutes(w.startHour, w.startMinutes);
          const newEndMinutes = timeToMinutes(hour, minutes);
          if (newEndMinutes <= startMinutes) {
            const adjustedStart = newEndMinutes - 30;
            const newStartHour = Math.floor(adjustedStart / 60);
            const newStartMinutes = adjustedStart % 60;
            if (newStartHour < MIN_HOUR) {
              return {
                ...w,
                startHour: MIN_HOUR,
                startMinutes: 0,
                endHour: hour,
                endMinutes: minutes,
              };
            }
            return {
              ...w,
              startHour: newStartHour,
              startMinutes: newStartMinutes,
              endHour: hour,
              endMinutes: minutes,
            };
          }
          return { ...w, endHour: hour, endMinutes: minutes };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const handleApply = useCallback(() => {
    onRulesChange?.(timeWindows, formatString);
  }, [timeWindows, formatString, onRulesChange]);

  return (
    <div className="z-50 min-w-[320px]">
      {/* Format Output Display */}

      {/* Time Windows List */}
      <div className="p-3 space-y-3 max-h-[350px] overflow-y-auto">
        {timeWindows.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <HiCalendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No hay ventanas definidas
          </div>
        )}
        {timeWindows.map((window, index) => {
          const windowCode = formatTimeWindowCode(window);
          const isAllWeeks = window.weeks.length === 0;

          return (
            <div
              key={window.id}
              className={twMerge(
                "rounded-xl border overflow-hidden",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700",
                "shadow-sm"
              )}
            >
              {/* Header with name and quota */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={window.name}
                  onChange={(e) =>
                    updateTimeWindowName(window.id, e.target.value)
                  }
                  placeholder={`Ventana ${index + 1}`}
                  className="text-sm font-semibold text-gray-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0 flex-1 max-w-[140px] placeholder:text-gray-400"
                />
                <div className="flex items-center gap-2">
                  {/* Quota badge */}
                  <div
                    className="flex items-center bg-primary-100 dark:bg-primary-900/30 rounded-full"
                    title="Cupos disponibles"
                  >
                    <button
                      type="button"
                      onClick={() => updateQuota(window.id, window.quota - 1)}
                      disabled={window.quota <= 0}
                      className={twMerge(
                        "w-6 h-6 flex items-center justify-center rounded-full text-primary-700 dark:text-primary-300 text-sm transition-colors",
                        window.quota <= 0
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-primary-200 dark:hover:bg-primary-800"
                      )}
                    >
                      −
                    </button>
                    <span className="min-w-[2ch] text-center text-sm font-bold text-primary-700 dark:text-primary-300">
                      {window.quota}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuota(window.id, window.quota + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-primary-700 dark:text-primary-300 text-sm transition-colors hover:bg-primary-200 dark:hover:bg-primary-800"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTimeWindow(window.id)}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                    title="Eliminar ventana"
                  >
                    <HiTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-3 space-y-2.5">
                {/* Time Range */}
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                  <HiClock className="h-4 w-4 text-gray-400 shrink-0" />
                  <Select
                    id={`start-${window.id}`}
                    sizing="sm"
                    value={formatTime(window.startHour, window.startMinutes)}
                    onChange={(e) =>
                      updateTimeWindow(window.id, "start", e.target.value)
                    }
                    className="flex-1 [&>select]:bg-transparent [&>select]:border-0 [&>select]:py-1"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <span className="text-gray-300 dark:text-gray-600">→</span>
                  <Select
                    id={`end-${window.id}`}
                    sizing="sm"
                    value={formatTime(window.endHour, window.endMinutes)}
                    onChange={(e) =>
                      updateTimeWindow(window.id, "end", e.target.value)
                    }
                    className="flex-1 [&>select]:bg-transparent [&>select]:border-0 [&>select]:py-1"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Days of Week */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleAllDays(window.id)}
                    title={
                      window.days.length === 7
                        ? "Deseleccionar todos"
                        : "Seleccionar todos"
                    }
                    className={twMerge(
                      "shrink-0 w-7 h-7 text-[9px] font-bold rounded-md transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1",
                      window.days.length === 7
                        ? "bg-primary-500 text-white shadow-sm hover:bg-primary-600"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    ✓
                  </button>
                  <div className="flex items-center flex-1 gap-0.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = window.days.includes(day.value);
                      const isWeekend = day.value === 6 || day.value === 7;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(window.id, day.value)}
                          title={day.fullLabel}
                          className={twMerge(
                            "flex-1 h-7 text-[10px] font-semibold rounded-md transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1",
                            isSelected
                              ? "bg-primary-500 text-white shadow-sm hover:bg-primary-600"
                              : isWeekend
                                ? "bg-orange-50 dark:bg-orange-900/20 text-orange-400 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weeks of Month */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleAllWeeks(window.id)}
                    title={
                      isAllWeeks ? "Seleccionar semanas" : "Todas las semanas"
                    }
                    className={twMerge(
                      "shrink-0 w-7 h-7 text-[9px] font-bold rounded-md transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1",
                      isAllWeeks
                        ? "bg-cyan-500 text-white shadow-sm hover:bg-cyan-600"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    W*
                  </button>
                  <div className="flex items-center flex-1 gap-0.5">
                    {WEEKS_OF_MONTH.map((week) => {
                      const isSelected = window.weeks.includes(week.value);
                      return (
                        <button
                          key={week.value}
                          type="button"
                          onClick={() => toggleWeek(window.id, week.value)}
                          title={week.fullLabel}
                          className={twMerge(
                            "flex-1 h-7 text-[10px] font-semibold rounded-md transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1",
                            isSelected
                              ? "bg-cyan-500 text-white shadow-sm hover:bg-cyan-600"
                              : isAllWeeks
                                ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                          )}
                        >
                          {week.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Format Code Display */}
                {windowCode && (
                  <div className="pt-1">
                    <code className="text-[10px] text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900/50 px-2 py-0.5 rounded">
                      {windowCode}
                    </code>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
        <Button color="light" size="sm" onClick={addTimeWindow}>
          <HiPlus className="h-4 w-4 mr-1.5" />
          Nueva ventana
        </Button>

        <Button size="sm" onClick={handleApply}>
          <HiCheck className="h-4 w-4 mr-1.5" />
          Aplicar
        </Button>
      </div>
    </div>
  );
}

export type { TimeWindow };
