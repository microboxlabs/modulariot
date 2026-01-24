"use client";

import { Button, Datepicker, Select } from "flowbite-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiPlus, HiTrash, HiCheck, HiClock, HiCalendar } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";
import {
  type TimeWindow,
  type TimeWindowColor,
  type ParsedWeeklyPattern,
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
  usePlanningSelection,
} from "../planning-selection-context";

/**
 * Time window configuration
 * Format output: W1-4 1-5 0900-1700
 * - W1-4: Weeks 1-4 of the month (W* for all weeks)
 * - 1-5: Days 1 (Monday) to 5 (Friday)
 * - 0900-1700: Time range in HHMM format
 *
 * Window types:
 * - "weekly": Applies to multiple days per week (default)
 * - "daily-override": Applies to a specific date, overrides weekly windows
 */

const MIN_HOUR = 0;
const MAX_HOUR = 23;

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

const COLOR_OPTIONS: { value: TimeWindowColor; label: string }[] = [
  { value: "emerald", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "violet", label: "Violeta" },
  { value: "rose", label: "Rosa" },
  { value: "amber", label: "Ámbar" },
  { value: "cyan", label: "Cian" },
  { value: "lime", label: "Lima" },
  { value: "orange", label: "Naranja" },
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

function timeToMinutes(hour: number, minutes: number): number {
  return hour * 60 + minutes;
}

/**
 * Generates the full format string for a time window
 * Uses TimeWindowUtils.formatDisplay for the new structure
 */
function formatTimeWindowCode(window: TimeWindow): string {
  return TimeWindowUtils.formatDisplay(window);
}

/**
 * Get parsed weekly pattern or default values
 */
function getWindowPattern(window: TimeWindow): ParsedWeeklyPattern {
  if (window.type === "weekly" && window.weeklyPattern) {
    const parsed = TimeWindowUtils.parseWeeklyPattern(window.weeklyPattern);
    if (parsed) return parsed;
  }
  if (window.type === "daily-override") {
    const timeRange = TimeWindowUtils.getTimeRange(window);
    if (timeRange) {
      return {
        weeks: [],
        days: [],
        ...timeRange,
      };
    }
  }
  // Default values
  return {
    weeks: [],
    days: [1, 2, 3, 4, 5],
    startHour: 8,
    startMinutes: 0,
    endHour: 12,
    endMinutes: 0,
  };
}

/**
 * Check if two time windows have overlapping days
 */
function hasOverlappingDays(a: TimeWindow, b: TimeWindow): boolean {
  const aPattern = getWindowPattern(a);
  const bPattern = getWindowPattern(b);
  return aPattern.days.some((day) => bPattern.days.includes(day));
}

/**
 * Check if two time windows have overlapping weeks
 * Empty weeks array means "all weeks"
 */
function hasOverlappingWeeks(a: TimeWindow, b: TimeWindow): boolean {
  const aPattern = getWindowPattern(a);
  const bPattern = getWindowPattern(b);
  // If either has empty weeks (all weeks), they overlap
  if (aPattern.weeks.length === 0 || bPattern.weeks.length === 0) return true;
  return aPattern.weeks.some((week) => bPattern.weeks.includes(week));
}

/**
 * Check if two time ranges overlap
 */
function hasOverlappingTime(a: TimeWindow, b: TimeWindow): boolean {
  const aPattern = getWindowPattern(a);
  const bPattern = getWindowPattern(b);
  const aStart = timeToMinutes(aPattern.startHour, aPattern.startMinutes);
  const aEnd = timeToMinutes(aPattern.endHour, aPattern.endMinutes);
  const bStart = timeToMinutes(bPattern.startHour, bPattern.startMinutes);
  const bEnd = timeToMinutes(bPattern.endHour, bPattern.endMinutes);

  // Two ranges overlap if one starts before the other ends
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Check if two time windows collide (overlap in days, weeks, AND time)
 * Note: weekly windows can collide with each other
 * Daily-override windows don't collide - they override weekly windows instead
 */
function windowsCollide(a: TimeWindow, b: TimeWindow): boolean {
  // Daily-override windows don't collide with anything - they override
  if (a.type === "daily-override" || b.type === "daily-override") {
    return false;
  }
  return (
    hasOverlappingDays(a, b) &&
    hasOverlappingWeeks(a, b) &&
    hasOverlappingTime(a, b)
  );
}

/**
 * Get IDs of windows that collide with the given window
 */
function getCollidingWindowIds(
  window: TimeWindow,
  allWindows: TimeWindow[]
): string[] {
  return allWindows
    .filter((w) => w.id !== window.id && windowsCollide(window, w))
    .map((w) => w.id);
}

/**
 * Portal-based Datepicker that renders outside overflow:hidden containers
 */
function PortalDatepicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (date: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-datepicker-portal]") &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const displayDate = value
    ? dayjs(value).format("DD/MM/YYYY")
    : "Seleccionar fecha";
  const dayName = value ? dayjs(value).format("dddd") : "";
  const minDate = dayjs().startOf("day").toDate();

  return (
    <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
      <HiCalendar className="h-4 w-4 text-yellow-500 shrink-0" />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex-1 text-left text-sm font-medium text-yellow-700 dark:text-yellow-300 bg-transparent border-0 focus:outline-none cursor-pointer"
      >
        {displayDate}
      </button>
      {dayName && (
        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
          {dayName}
        </span>
      )}
      {isOpen &&
        createPortal(
          <div
            data-datepicker-portal
            className="fixed z-[9999]"
            style={{ top: position.top, left: position.left }}
          >
            <Datepicker
              inline
              value={value ? dayjs(value).toDate() : undefined}
              minDate={minDate}
              onChange={(date) => {
                if (date) {
                  onChange(dayjs(date).format("YYYY-MM-DD"));
                }
                setIsOpen(false);
              }}
              language="es-ES"
              labelTodayButton="Hoy"
              labelClearButton="Limpiar"
              showClearButton={false}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Custom color picker dropdown with color circles (portal-based)
 */
function ColorPickerDropdown({
  value,
  onChange,
}: {
  value: TimeWindowColor;
  onChange: (color: TimeWindowColor) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 120, // Align right edge
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-colorpicker-portal]") &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={twMerge(
          "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
          "bg-gray-100 dark:bg-gray-900/50 hover:bg-gray-200 dark:hover:bg-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-primary-300"
        )}
        title="Cambiar color"
      >
        <span
          className={twMerge(
            "w-4 h-4 rounded-full",
            TIME_WINDOW_COLORS[value].dot
          )}
        />
      </button>
      {isOpen &&
        createPortal(
          <div
            data-colorpicker-portal
            className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
            style={{ top: position.top, left: position.left }}
          >
            {COLOR_OPTIONS.map((colorOpt) => (
              <button
                key={colorOpt.value}
                type="button"
                onClick={() => {
                  onChange(colorOpt.value);
                  setIsOpen(false);
                }}
                className={twMerge(
                  "w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  value === colorOpt.value && "bg-gray-50 dark:bg-gray-700/50"
                )}
              >
                <span
                  className={twMerge(
                    "w-3 h-3 rounded-full shrink-0",
                    TIME_WINDOW_COLORS[colorOpt.value].dot
                  )}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {colorOpt.label}
                </span>
                {value === colorOpt.value && (
                  <HiCheck className="ml-auto h-3 w-3 text-primary-500" />
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

interface QuotaManagerProps {
  onRulesChange?: (windows: TimeWindow[], formatString: string) => void;
}

export default function QuotaManager({
  onRulesChange,
}: Readonly<QuotaManagerProps>) {
  const { timeWindows, setTimeWindows } = usePlanningSelection();
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // Auto-delete expired daily-override exceptions (date before today)
  useEffect(() => {
    const expiredIds = timeWindows
      .filter((w) => TimeWindowUtils.isExpired(w))
      .map((w) => w.id);

    if (expiredIds.length > 0) {
      setTimeWindows(timeWindows.filter((w) => !expiredIds.includes(w.id)));
    }
  }, [timeWindows, setTimeWindows]);

  // Generate the combined format string for all windows
  const formatString = useMemo(() => {
    return timeWindows
      .map((w) => formatTimeWindowCode(w))
      .filter(Boolean)
      .join(", ");
  }, [timeWindows]);

  // Calculate which windows have collisions (only weekly vs weekly)
  const windowsWithCollisions = useMemo(() => {
    const collisions = new Set<string>();
    const weeklyWindows = timeWindows.filter((w) => w.type === "weekly");
    for (const window of weeklyWindows) {
      const collidingIds = getCollidingWindowIds(window, weeklyWindows);
      if (collidingIds.length > 0) {
        collisions.add(window.id);
        collidingIds.forEach((id) => collisions.add(id));
      }
    }
    return collisions;
  }, [timeWindows]);

  const hasAnyCollision = windowsWithCollisions.size > 0;

  const addTimeWindow = useCallback(
    (type: "weekly" | "daily-override" = "weekly") => {
      const today = dayjs();
      const newWindow: TimeWindow =
        type === "weekly"
          ? {
              id: crypto.randomUUID(),
              name: "",
              kind: "window",
              type: "weekly",
              quota: 1,
              color: "emerald",
              weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
                [], // All weeks
                [1, 2, 3, 4, 5], // Monday to Friday
                8,
                0,
                12,
                0
              ),
            }
          : {
              id: crypto.randomUUID(),
              name: "",
              kind: "window",
              type: "daily-override",
              quota: 1,
              color: "emerald",
              startTimestamp: today
                .hour(8)
                .minute(0)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
              endTimestamp: today
                .hour(12)
                .minute(0)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
            };
      setTimeWindows([...timeWindows, newWindow]);
    },
    [timeWindows, setTimeWindows]
  );

  const updateWindowType = useCallback(
    (id: string, type: "weekly" | "daily-override") => {
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id) return w;
          const pattern = getWindowPattern(w);
          const today = dayjs();

          if (type === "daily-override") {
            // Convert to daily-override: use today + existing time
            return {
              ...w,
              type,
              weeklyPattern: undefined,
              startTimestamp: today
                .hour(pattern.startHour)
                .minute(pattern.startMinutes)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
              endTimestamp: today
                .hour(pattern.endHour)
                .minute(pattern.endMinutes)
                .second(0)
                .format("YYYY-MM-DDTHH:mm:ss"),
            };
          }
          // Convert to weekly: use existing time + default weekdays
          return {
            ...w,
            type,
            startTimestamp: undefined,
            endTimestamp: undefined,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              [],
              [1, 2, 3, 4, 5],
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const updateDailyOverrideDate = useCallback(
    (id: string, date: string) => {
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id || w.type !== "daily-override") return w;
          const pattern = getWindowPattern(w);
          const newDate = dayjs(date);
          return {
            ...w,
            startTimestamp: newDate
              .hour(pattern.startHour)
              .minute(pattern.startMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
            endTimestamp: newDate
              .hour(pattern.endHour)
              .minute(pattern.endMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
          };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const updateTimeWindowName = useCallback(
    (id: string, name: string) => {
      setTimeWindows(
        timeWindows.map((w) => (w.id === id ? { ...w, name } : w))
      );
    },
    [timeWindows, setTimeWindows]
  );

  const updateWindowColor = useCallback(
    (id: string, color: TimeWindowColor) => {
      setTimeWindows(
        timeWindows.map((w) => (w.id === id ? { ...w, color } : w))
      );
    },
    [timeWindows, setTimeWindows]
  );

  const removeTimeWindow = useCallback(
    (id: string) => {
      setTimeWindows(timeWindows.filter((w) => w.id !== id));
    },
    [timeWindows, setTimeWindows]
  );

  const toggleDay = useCallback(
    (id: string, day: number) => {
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id || w.type !== "weekly") return w;
          const pattern = getWindowPattern(w);
          const days = pattern.days.includes(day)
            ? pattern.days.filter((d) => d !== day)
            : [...pattern.days, day];
          return {
            ...w,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              pattern.weeks,
              days,
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const toggleAllDays = useCallback(
    (id: string) => {
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id || w.type !== "weekly") return w;
          const pattern = getWindowPattern(w);
          const allDays = DAYS_OF_WEEK.map((d) => d.value);
          const hasAllDays = allDays.every((d) => pattern.days.includes(d));
          const newDays = hasAllDays ? [] : allDays;
          return {
            ...w,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              pattern.weeks,
              newDays,
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const toggleWeek = useCallback(
    (id: string, week: number) => {
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id || w.type !== "weekly") return w;
          const pattern = getWindowPattern(w);
          const weeks = pattern.weeks.includes(week)
            ? pattern.weeks.filter((wk) => wk !== week)
            : [...pattern.weeks, week];
          return {
            ...w,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              weeks,
              pattern.days,
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const toggleAllWeeks = useCallback(
    (id: string) => {
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id || w.type !== "weekly") return w;
          const pattern = getWindowPattern(w);
          const hasAllWeeks = pattern.weeks.length === 0;
          const newWeeks = hasAllWeeks ? [1, 2, 3, 4] : [];
          return {
            ...w,
            weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
              newWeeks,
              pattern.days,
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            ),
          };
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const updateQuota = useCallback(
    (id: string, quota: number) => {
      setTimeWindows(
        timeWindows.map((w) =>
          w.id === id ? { ...w, quota: Math.max(0, quota) } : w
        )
      );
    },
    [timeWindows, setTimeWindows]
  );

  const updateTimeWindow = useCallback(
    (id: string, field: "start" | "end", timeStr: string) => {
      const { hour, minutes } = parseTime(timeStr);
      setTimeWindows(
        timeWindows.map((w) => {
          if (w.id !== id) return w;
          const pattern = getWindowPattern(w);

          let newStartHour = pattern.startHour;
          let newStartMinutes = pattern.startMinutes;
          let newEndHour = pattern.endHour;
          let newEndMinutes = pattern.endMinutes;

          if (field === "start") {
            const newStartMin = timeToMinutes(hour, minutes);
            const endMin = timeToMinutes(pattern.endHour, pattern.endMinutes);
            if (newStartMin >= endMin) {
              // Adjust end time
              const adjustedEnd = newStartMin + 30;
              newEndHour = Math.min(Math.floor(adjustedEnd / 60), MAX_HOUR);
              newEndMinutes = newEndHour === MAX_HOUR ? 0 : adjustedEnd % 60;
            }
            newStartHour = hour;
            newStartMinutes = minutes;
          } else {
            const startMin = timeToMinutes(
              pattern.startHour,
              pattern.startMinutes
            );
            const newEndMin = timeToMinutes(hour, minutes);
            if (newEndMin <= startMin) {
              // Adjust start time
              const adjustedStart = Math.max(newEndMin - 30, 0);
              newStartHour = Math.floor(adjustedStart / 60);
              newStartMinutes = adjustedStart % 60;
            }
            newEndHour = hour;
            newEndMinutes = minutes;
          }

          if (w.type === "weekly") {
            return {
              ...w,
              weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
                pattern.weeks,
                pattern.days,
                newStartHour,
                newStartMinutes,
                newEndHour,
                newEndMinutes
              ),
            };
          }

          // For daily-override, update timestamps
          const currentDate = w.startTimestamp
            ? dayjs(w.startTimestamp)
            : dayjs();
          return {
            ...w,
            startTimestamp: currentDate
              .hour(newStartHour)
              .minute(newStartMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
            endTimestamp: currentDate
              .hour(newEndHour)
              .minute(newEndMinutes)
              .second(0)
              .format("YYYY-MM-DDTHH:mm:ss"),
          };
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
      <div className="p-3 space-y-3 max-h-[350px] overflow-y-auto overflow-x-visible">
        {timeWindows.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <HiCalendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No hay ventanas definidas
          </div>
        )}
        {timeWindows.map((window, index) => {
          const windowCode = formatTimeWindowCode(window);
          const pattern = getWindowPattern(window);
          const isAllWeeks = pattern.weeks.length === 0;
          const hasCollision = windowsWithCollisions.has(window.id);
          const windowDate = TimeWindowUtils.getDate(window);

          return (
            <div
              key={window.id}
              className={twMerge(
                "rounded-xl border",
                "bg-white dark:bg-gray-800",
                "shadow-sm",
                hasCollision
                  ? "border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-900/50"
                  : "border-gray-200 dark:border-gray-700"
              )}
            >
              {/* Header with name and quota */}
              <div
                className={twMerge(
                  "flex items-center justify-between px-3 py-2 border-b rounded-t-xl",
                  hasCollision
                    ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
                    : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  {hasCollision && (
                    <span
                      className="text-red-500 text-xs"
                      title="Conflicto de horarios"
                    >
                      ⚠️
                    </span>
                  )}
                  <input
                    type="text"
                    value={window.name}
                    onChange={(e) =>
                      updateTimeWindowName(window.id, e.target.value)
                    }
                    placeholder={`Ventana ${index + 1}`}
                    className={twMerge(
                      "text-sm font-semibold bg-transparent border-0 focus:ring-0 p-0 flex-1 max-w-[140px] placeholder:text-gray-400",
                      hasCollision
                        ? "text-red-700 dark:text-red-300"
                        : "text-gray-900 dark:text-white"
                    )}
                  />
                </div>
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
                    <input
                      type="number"
                      min="0"
                      defaultValue={window.quota}
                      key={`quota-${window.id}-${window.quota}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value =
                            parseInt((e.target as HTMLInputElement).value) || 0;
                          updateQuota(window.id, value);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        updateQuota(window.id, value);
                      }}
                      className="w-8 text-center text-sm font-bold text-primary-700 dark:text-primary-300 bg-transparent border-0 focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
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
              <div className="p-3 flex flex-col gap-2.5 overflow-visible">
                {/* Window Type Toggle + Color Picker */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg flex-1">
                    <button
                      type="button"
                      onClick={() => updateWindowType(window.id, "weekly")}
                      className={twMerge(
                        "flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all duration-200",
                        window.type === "weekly"
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      Semanal
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateWindowType(window.id, "daily-override")
                      }
                      className={twMerge(
                        "flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all duration-200",
                        window.type === "daily-override"
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      Excepción día
                    </button>
                  </div>
                  {/* Color Picker Dropdown */}
                  <ColorPickerDropdown
                    value={window.color || "emerald"}
                    onChange={(color) => updateWindowColor(window.id, color)}
                  />
                </div>

                {/* Time Range */}
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                  <HiClock className="h-4 w-4 text-gray-400 shrink-0" />
                  <Select
                    id={`start-${window.id}`}
                    sizing="sm"
                    value={formatTime(pattern.startHour, pattern.startMinutes)}
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
                    value={formatTime(pattern.endHour, pattern.endMinutes)}
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

                {/* Days of Week - Different UI based on window type */}
                {window.type === "weekly" ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleAllDays(window.id)}
                      title={
                        pattern.days.length === 7
                          ? "Deseleccionar todos"
                          : "Seleccionar todos"
                      }
                      className={twMerge(
                        "shrink-0 w-7 h-7 text-[9px] font-bold rounded-md transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1",
                        pattern.days.length === 7
                          ? "bg-primary-500 text-white shadow-sm hover:bg-primary-600"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      )}
                    >
                      ✓
                    </button>
                    <div className="flex items-center flex-1 gap-0.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = pattern.days.includes(day.value);
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
                                  ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Daily Override - Date Selection */
                  <PortalDatepicker
                    value={windowDate ?? undefined}
                    onChange={(date) =>
                      updateDailyOverrideDate(window.id, date)
                    }
                  />
                )}

                {/* Weeks of Month - Only for weekly windows */}
                {window.type === "weekly" && (
                  <div className="items-center gap-1 hidden">
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
                        const isSelected = pattern.weeks.includes(week.value);
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
                )}

                {/* Format Code Display */}
                {windowCode && (
                  <div className="pt-1 hidden">
                    <code className="text-[10px] hidden text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900/50 px-2 py-0.5 rounded">
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
      <div
        className={twMerge(
          "p-3 border-t flex items-center justify-between",
          hasAnyCollision
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700"
        )}
      >
        <Button color="light" size="sm" onClick={() => addTimeWindow("weekly")}>
          <HiPlus className="h-4 w-4 mr-1.5" />
          Ventana
        </Button>

        <Button
          size="sm"
          onClick={handleApply}
          disabled={hasAnyCollision}
          color={hasAnyCollision ? "failure" : undefined}
          className={hasAnyCollision ? "opacity-50 cursor-not-allowed" : ""}
        >
          <HiCheck className="h-4 w-4 mr-1.5" />
          Aplicar
        </Button>
      </div>
    </div>
  );
}

export type { TimeWindow };
