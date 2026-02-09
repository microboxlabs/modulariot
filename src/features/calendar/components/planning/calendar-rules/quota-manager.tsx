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
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
  usePlanningSelection,
} from "../planning-selection-context";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import {
  DAYS_OF_WEEK,
  WEEKS_OF_MONTH,
  generateTimeOptions,
  parseTime,
  formatTime,
  adjustTimeRange,
  getSlotPattern,
  buildWeeklySlot,
  buildDailyOverrideSlot,
  calculateCollisions,
} from "./time-slot-utils";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

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

function getDayButtonClassName(
  isSelected: boolean,
  isWeekend: boolean
): string {
  if (isSelected) {
    return "bg-primary-500 text-white shadow-sm hover:bg-primary-600";
  }
  if (isWeekend) {
    return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40";
  }
  return "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600";
}

function getWeekButtonClassName(
  isSelected: boolean,
  isAllWeeks: boolean
): string {
  if (isSelected) {
    return "bg-cyan-500 text-white shadow-sm hover:bg-cyan-600";
  }
  if (isAllWeeks) {
    return "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/40";
  }
  return "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600";
}

/** Color options for time windows using the common ColorPickerDropdown */
function getColorOptions(
  messages: QuotaManagerMessages
): ColorOption<TimeWindowColor>[] {
  return [
    {
      value: "emerald",
      label: messages.colors.emerald,
      dotClass: TIME_WINDOW_COLORS.emerald.dot,
    },
    {
      value: "blue",
      label: messages.colors.blue,
      dotClass: TIME_WINDOW_COLORS.blue.dot,
    },
    {
      value: "violet",
      label: messages.colors.violet,
      dotClass: TIME_WINDOW_COLORS.violet.dot,
    },
    {
      value: "rose",
      label: messages.colors.rose,
      dotClass: TIME_WINDOW_COLORS.rose.dot,
    },
    {
      value: "amber",
      label: messages.colors.amber,
      dotClass: TIME_WINDOW_COLORS.amber.dot,
    },
    {
      value: "cyan",
      label: messages.colors.cyan,
      dotClass: TIME_WINDOW_COLORS.cyan.dot,
    },
    {
      value: "lime",
      label: messages.colors.lime,
      dotClass: TIME_WINDOW_COLORS.lime.dot,
    },
    {
      value: "orange",
      label: messages.colors.orange,
      dotClass: TIME_WINDOW_COLORS.orange.dot,
    },
  ];
}

/**
 * Generates the full format string for a time window
 * Uses TimeWindowUtils.formatDisplay for the new structure
 */
function formatTimeWindowCode(window: TimeWindow): string {
  return TimeWindowUtils.formatDisplay(window);
}

/**
 * Portal-based Datepicker that renders outside overflow:hidden containers
 */
function PortalDatepicker({
  value,
  onChange,
  messages,
}: Readonly<{
  value: string | undefined;
  onChange: (date: string) => void;
  messages: { selectDate: string; today: string; clear: string };
}>) {
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
    : messages.selectDate;
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
              labelTodayButton={messages.today}
              labelClearButton={messages.clear}
              showClearButton={false}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

export interface QuotaManagerMessages {
  noWindows: string;
  windowPlaceholder: string;
  availableQuotas: string;
  deleteWindow: string;
  weekly: string;
  dailyException: string;
  selectDate: string;
  selectAll: string;
  deselectAll: string;
  selectWeeks: string;
  allWeeks: string;
  scheduleConflict: string;
  addWindow: string;
  apply: string;
  today: string;
  clear: string;
  colors: {
    emerald: string;
    blue: string;
    violet: string;
    rose: string;
    amber: string;
    cyan: string;
    lime: string;
    orange: string;
  };
}

const QUOTA_MANAGER_BASE =
  "layout.planning.calendarRules.quotaManagement" as const;

export function getQuotaManagerMessages(
  dict: I18nDictionary
): QuotaManagerMessages {
  return {
    noWindows: tr(`${QUOTA_MANAGER_BASE}.noWindows`, dict),
    windowPlaceholder: tr(`${QUOTA_MANAGER_BASE}.windowPlaceholder`, dict),
    availableQuotas: tr(`${QUOTA_MANAGER_BASE}.availableQuotas`, dict),
    deleteWindow: tr(`${QUOTA_MANAGER_BASE}.deleteWindow`, dict),
    weekly: tr(`${QUOTA_MANAGER_BASE}.weekly`, dict),
    dailyException: tr(`${QUOTA_MANAGER_BASE}.dailyException`, dict),
    selectDate: tr(`${QUOTA_MANAGER_BASE}.selectDate`, dict),
    selectAll: tr(`${QUOTA_MANAGER_BASE}.selectAll`, dict),
    deselectAll: tr(`${QUOTA_MANAGER_BASE}.deselectAll`, dict),
    selectWeeks: tr(`${QUOTA_MANAGER_BASE}.selectWeeks`, dict),
    allWeeks: tr(`${QUOTA_MANAGER_BASE}.allWeeks`, dict),
    scheduleConflict: tr(`${QUOTA_MANAGER_BASE}.scheduleConflict`, dict),
    addWindow: tr(`${QUOTA_MANAGER_BASE}.addWindow`, dict),
    apply: tr(`${QUOTA_MANAGER_BASE}.apply`, dict),
    today: tr(`${QUOTA_MANAGER_BASE}.today`, dict),
    clear: tr(`${QUOTA_MANAGER_BASE}.clear`, dict),
    colors: {
      emerald: tr(`${QUOTA_MANAGER_BASE}.colors.emerald`, dict),
      blue: tr(`${QUOTA_MANAGER_BASE}.colors.blue`, dict),
      violet: tr(`${QUOTA_MANAGER_BASE}.colors.violet`, dict),
      rose: tr(`${QUOTA_MANAGER_BASE}.colors.rose`, dict),
      amber: tr(`${QUOTA_MANAGER_BASE}.colors.amber`, dict),
      cyan: tr(`${QUOTA_MANAGER_BASE}.colors.cyan`, dict),
      lime: tr(`${QUOTA_MANAGER_BASE}.colors.lime`, dict),
      orange: tr(`${QUOTA_MANAGER_BASE}.colors.orange`, dict),
    },
  };
}

interface QuotaManagerProps {
  messages: QuotaManagerMessages;
  onRulesChange?: (windows: TimeWindow[], formatString: string) => void;
}

export default function QuotaManager({
  messages,
  onRulesChange,
}: Readonly<QuotaManagerProps>) {
  const { timeWindows, setTimeWindows, syncTimeSlotsToAPI } =
    usePlanningSelection();
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  const colorOptions = useMemo(() => getColorOptions(messages), [messages]);

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
  const windowsWithCollisions = useMemo(
    () => calculateCollisions(timeWindows),
    [timeWindows]
  );

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
          const pattern = getSlotPattern(w);

          if (type === "daily-override") {
            return buildDailyOverrideSlot(
              w,
              dayjs(),
              pattern.startHour,
              pattern.startMinutes,
              pattern.endHour,
              pattern.endMinutes
            );
          }
          return buildWeeklySlot(w, {
            ...pattern,
            weeks: [],
            days: [1, 2, 3, 4, 5],
          });
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
          const pattern = getSlotPattern(w);
          return buildDailyOverrideSlot(
            w,
            dayjs(date),
            pattern.startHour,
            pattern.startMinutes,
            pattern.endHour,
            pattern.endMinutes
          );
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
          const pattern = getSlotPattern(w);
          const days = pattern.days.includes(day)
            ? pattern.days.filter((d) => d !== day)
            : [...pattern.days, day];
          return buildWeeklySlot(w, { ...pattern, days });
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
          const pattern = getSlotPattern(w);
          const allDays = DAYS_OF_WEEK.map((d) => d.value);
          const hasAllDays = allDays.every((d) => pattern.days.includes(d));
          const days = hasAllDays ? [] : [...allDays];
          return buildWeeklySlot(w, { ...pattern, days });
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
          const pattern = getSlotPattern(w);
          const weeks = pattern.weeks.includes(week)
            ? pattern.weeks.filter((wk) => wk !== week)
            : [...pattern.weeks, week];
          return buildWeeklySlot(w, { ...pattern, weeks });
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
          const pattern = getSlotPattern(w);
          const hasAllWeeks = pattern.weeks.length === 0;
          const weeks = hasAllWeeks ? [1, 2, 3, 4] : [];
          return buildWeeklySlot(w, { ...pattern, weeks });
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
          const pattern = getSlotPattern(w);
          const adjusted = adjustTimeRange(pattern, field, hour, minutes);

          if (w.type === "weekly") {
            return buildWeeklySlot(w, { ...pattern, ...adjusted });
          }

          const currentDate = w.startTimestamp
            ? dayjs(w.startTimestamp)
            : dayjs();
          return buildDailyOverrideSlot(
            w,
            currentDate,
            adjusted.startHour,
            adjusted.startMinutes,
            adjusted.endHour,
            adjusted.endMinutes
          );
        })
      );
    },
    [timeWindows, setTimeWindows]
  );

  const handleApply = useCallback(async () => {
    try {
      // Sync current time windows to API
      await syncTimeSlotsToAPI();
      // Call the parent callback (closes modal, etc.)
      onRulesChange?.(timeWindows, formatString);
    } catch (error) {
      console.error("Error syncing time windows to API:", error);
      // Still call the callback to close modal even if API sync fails
      onRulesChange?.(timeWindows, formatString);
    }
  }, [timeWindows, formatString, onRulesChange, syncTimeSlotsToAPI]);

  return (
    <div className="z-50 min-w-[320px]">
      {/* Format Output Display */}

      {/* Time Windows List */}
      <div className="p-3 space-y-3 max-h-[350px] overflow-y-auto overflow-x-visible">
        {timeWindows.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <HiCalendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {messages.noWindows}
          </div>
        )}
        {timeWindows.map((window, index) => {
          const windowCode = formatTimeWindowCode(window);
          const pattern = getSlotPattern(window);
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
                      title={messages.scheduleConflict}
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
                    placeholder={messages.windowPlaceholder.replace(
                      "{index}",
                      String(index + 1)
                    )}
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
                    title={messages.availableQuotas}
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
                            Number.parseInt(
                              (e.target as HTMLInputElement).value
                            ) || 0;
                          updateQuota(window.id, value);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={(e) => {
                        const value = Number.parseInt(e.target.value) || 0;
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
                    title={messages.deleteWindow}
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
                      {messages.weekly}
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
                      {messages.dailyException}
                    </button>
                  </div>
                  {/* Color Picker Dropdown */}
                  <ColorPickerDropdown
                    value={window.color || "emerald"}
                    onChange={(color) => updateWindowColor(window.id, color)}
                    options={colorOptions}
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
                          ? messages.deselectAll
                          : messages.selectAll
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
                              getDayButtonClassName(isSelected, isWeekend)
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
                    messages={{
                      selectDate: messages.selectDate,
                      today: messages.today,
                      clear: messages.clear,
                    }}
                  />
                )}

                {/* Weeks of Month - Only for weekly windows */}
                {window.type === "weekly" && (
                  <div className="items-center gap-1 hidden">
                    <button
                      type="button"
                      onClick={() => toggleAllWeeks(window.id)}
                      title={
                        isAllWeeks ? messages.selectWeeks : messages.allWeeks
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
                              getWeekButtonClassName(isSelected, isAllWeeks)
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
          {messages.addWindow}
        </Button>

        <Button
          size="sm"
          onClick={handleApply}
          disabled={hasAnyCollision}
          color={hasAnyCollision ? "failure" : undefined}
          className={hasAnyCollision ? "opacity-50 cursor-not-allowed" : ""}
        >
          <HiCheck className="h-4 w-4 mr-1.5" />
          {messages.apply}
        </Button>
      </div>
    </div>
  );
}

export type { TimeWindow } from "../planning-selection-context";
