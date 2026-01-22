"use client";

import { Fragment, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);
import { twMerge } from "tailwind-merge";
import { Tooltip } from "flowbite-react";
import type {
  PlanningWeekViewProps,
  WeekDay,
} from "./planning-week-view.types";
import {
  DATE_FORMAT,
  generateTimeSlots,
} from "@/features/calendar/services/calendar.service";
import {
  usePlanningSelection,
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
} from "./planning-selection-context";

const DAYS_IN_WORK_WEEK = 7; // Mon-Sat

function parseUrlDate(dateStr: string | null): dayjs.Dayjs | null {
  if (!dateStr) return null;
  const parsed = dayjs(dateStr, DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function generateWeekDays(currentDate: Date, lang: string): WeekDay[] {
  const locale = lang === "es" ? "es" : "en";
  const monday = dayjs(currentDate).startOf("isoWeek"); // ISO week always starts on Monday
  const today = dayjs().startOf("day");

  return Array.from({ length: DAYS_IN_WORK_WEEK }, (_, i) => {
    const date = monday.add(i, "day").locale(locale);
    return {
      date: date.toDate(),
      dayName: date.format("ddd").toUpperCase(),
      dayNumber: date.date(),
      isToday: date.isSame(today, "day"),
    };
  });
}

export default function PlanningWeekView({
  lang,
  currentDate: propDate,
  startHour = 8,
  endHour = 22,
}: Readonly<PlanningWeekViewProps>) {
  const searchParams = useSearchParams();
  const {
    selectedSlot,
    selectSlot,
    plannedServices,
    getTimeWindowForSlot,
    getRemainingQuota,
    isSlotBlocked,
    getBlocksForSlot,
  } = usePlanningSelection();

  // Read date from URL, fallback to prop or today
  const currentDate = useMemo(() => {
    const urlDate = parseUrlDate(searchParams.get("date"));
    if (urlDate) return urlDate.toDate();
    if (propDate) return propDate;
    return new Date();
  }, [searchParams, propDate]);

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour),
    [startHour, endHour]
  );

  const weekDays = useMemo(
    () => generateWeekDays(currentDate, lang),
    [currentDate, lang]
  );

  // Get today for past day comparison
  const today = useMemo(() => dayjs().startOf("day"), []);

  const isLastDay = (idx: number) => idx === weekDays.length - 1;
  const isLastSlot = (idx: number) => idx === timeSlots.length - 1;
  const isPastDay = useCallback(
    (day: WeekDay) => dayjs(day.date).isBefore(today, "day"),
    [today]
  );

  const handleCellClick = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      selectSlot({
        date: day.date,
        hour: slot.hour,
        minutes: slot.minutes,
        dayIndex: weekDays.findIndex((d) => d.date === day.date),
      });
    },
    [selectSlot, weekDays]
  );

  const isSlotSelected = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      if (!selectedSlot) return false;
      return (
        dayjs(selectedSlot.date).isSame(day.date, "day") &&
        selectedSlot.hour === slot.hour &&
        selectedSlot.minutes === slot.minutes
      );
    },
    [selectedSlot]
  );

  const getPlannedServicesForSlot = useCallback(
    (day: WeekDay, slot: { hour: number; minutes: number }) => {
      return plannedServices.filter(
        (ps) =>
          dayjs(ps.slot.date).isSame(day.date, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
      );
    },
    [plannedServices]
  );

  return (
    <div className="w-full h-full overflow-auto">
      <div
        className="grid min-w-[600px]"
        style={{
          gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)`,
        }}
      >
        {/* Header row - empty corner cell */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div className="h-16 border-l border-t border-gray-200 dark:border-gray-700 rounded-tl-lg bg-gray-50 dark:bg-gray-900" />
        </div>

        {/* Header row - day columns */}
        {weekDays.map((day, idx) => (
          <div
            key={day.dayNumber}
            className="sticky top-0 z-10 bg-white dark:bg-gray-800"
          >
            <div
              className={twMerge(
                "h-16 flex flex-col items-center justify-center",
                "border-l border-t border-gray-200 dark:border-gray-700",
                "bg-gray-50 dark:bg-gray-900",
                isLastDay(idx) && "border-r rounded-tr-lg"
              )}
            >
              <span
                className={twMerge(
                  "text-xs font-medium",
                  day.isToday
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {day.dayName}
              </span>
              <span
                className={twMerge(
                  "text-lg font-semibold",
                  day.isToday
                    ? "bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    : "text-gray-900 dark:text-white"
                )}
              >
                {day.dayNumber}
              </span>
            </div>
          </div>
        ))}

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIdx) => {
          return (
            <Fragment key={slot.label}>
              {/* Time label column */}
              <div
                className={twMerge(
                  "min-h-12 flex items-start justify-end pr-2 pt-0.5",
                  "border-l border-t border-gray-200 dark:border-gray-700",
                  "text-xs text-gray-500 dark:text-gray-400",
                  isLastSlot(slotIdx) && "border-b rounded-bl-lg"
                )}
              >
                {slot.label}
              </div>

              {/* Day cells */}
              {weekDays.map((day, dayIdx) => {
                const selected = isSlotSelected(day, slot);
                const slotServices = getPlannedServicesForSlot(day, slot);
                const dayIsPast = isPastDay(day);

                // Check if slot is blocked (priority over quotas)
                const slotBlocked = isSlotBlocked(
                  day.date,
                  slot.hour,
                  slot.minutes
                );
                const blocksForSlot = slotBlocked
                  ? getBlocksForSlot(day.date, slot.hour, slot.minutes)
                  : [];
                const blockNames = blocksForSlot
                  .map((b) => b.name || "Bloqueado")
                  .join(", ");

                const timeWindow = getTimeWindowForSlot(
                  day.date,
                  slot.hour,
                  slot.minutes
                );
                const hasTimeWindow = timeWindow !== null;
                // Get time range for this window
                const timeRange = hasTimeWindow
                  ? TimeWindowUtils.getTimeRange(timeWindow)
                  : null;
                // Show name only on the first slot of the time window
                const isWindowStart =
                  hasTimeWindow &&
                  timeRange !== null &&
                  slot.hour === timeRange.startHour &&
                  slot.minutes === timeRange.startMinutes;
                // Get remaining quota for this day
                const remainingQuota = hasTimeWindow
                  ? getRemainingQuota(timeWindow, day.date)
                  : 0;
                const isQuotaFull = remainingQuota === 0;
                const isDailyOverride =
                  hasTimeWindow && timeWindow.type === "daily-override";
                // Blocked slots take priority over everything except past days
                const isDisabled = dayIsPast || slotBlocked || isQuotaFull;
                // Get color classes from the time window
                const windowColor =
                  hasTimeWindow && timeWindow.color
                    ? TIME_WINDOW_COLORS[timeWindow.color]
                    : TIME_WINDOW_COLORS.emerald;

                // Diagonal stripes class for blocked slots (light/dark mode compatible)
                const blockedStripeClass =
                  slotBlocked && !dayIsPast
                    ? "[background:repeating-linear-gradient(45deg,rgb(254,242,242),rgb(254,242,242)_4px,rgba(239,68,68,0.2)_4px,rgba(239,68,68,0.2)_8px)] dark:[background:repeating-linear-gradient(45deg,rgb(55,48,48),rgb(55,48,48)_4px,rgba(239,68,68,0.3)_4px,rgba(239,68,68,0.3)_8px)]"
                    : "";

                const cellContent = (
                  <button
                    type="button"
                    key={`${day.dayNumber}-${slot.label}`}
                    onClick={() => !isDisabled && handleCellClick(day, slot)}
                    disabled={isDisabled}
                    className={twMerge(
                      "h-full w-full relative",
                      "border-l border-t border-gray-200 dark:border-gray-700",
                      "transition-all duration-200 p-1",
                      blockedStripeClass,
                      dayIsPast && "bg-gray-100 dark:bg-gray-900/50 opacity-50",
                      isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                      !dayIsPast && !slotBlocked && isQuotaFull && "opacity-60",
                      // Time window with custom color (not full, not selected, not past, not blocked)
                      !dayIsPast &&
                        !slotBlocked &&
                        hasTimeWindow &&
                        !selected &&
                        !isQuotaFull &&
                        windowColor.bg,
                      // Quota full - show red (not blocked)
                      !dayIsPast &&
                        !slotBlocked &&
                        hasTimeWindow &&
                        !selected &&
                        isQuotaFull &&
                        "bg-red-50 dark:bg-red-900/20",
                      selected
                        ? "bg-primary-100 dark:bg-primary-900/40 ring-2 ring-inset ring-primary-500"
                        : !dayIsPast &&
                            !slotBlocked &&
                            !hasTimeWindow &&
                            "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                      !dayIsPast &&
                        !slotBlocked &&
                        hasTimeWindow &&
                        !selected &&
                        !isQuotaFull &&
                        windowColor.hover,
                      isLastDay(dayIdx) && "border-r",
                      isLastSlot(slotIdx) && "border-b",
                      isLastDay(dayIdx) &&
                        isLastSlot(slotIdx) &&
                        "rounded-br-lg"
                    )}
                  >
                    {/* Blocked slot indicator */}
                    {!dayIsPast && slotBlocked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-red-500/60 text-lg">⊘</span>
                      </div>
                    )}
                    {/* Time window name - only on first slot and not past day and not blocked */}
                    {!dayIsPast &&
                      !slotBlocked &&
                      isWindowStart &&
                      timeWindow.name && (
                        <div className="absolute -top-0.5 left-1 right-1 flex items-center justify-center pointer-events-none">
                          <span
                            className={twMerge(
                              "text-[9px] font-semibold px-1.5 py-0.5 rounded-b shadow-sm truncate max-w-full",
                              isQuotaFull
                                ? "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-800/80"
                                : windowColor.badge
                            )}
                          >
                            {timeWindow.name}
                          </span>
                        </div>
                      )}
                    {/* Quota badge - only on first slot and not past day and not blocked */}
                    {!dayIsPast && !slotBlocked && isWindowStart && (
                      <div className="absolute top-0.5 right-0.5">
                        <span
                          className={twMerge(
                            "text-[9px] font-bold px-1 rounded",
                            isQuotaFull
                              ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50"
                              : windowColor.badge
                          )}
                        >
                          {remainingQuota}/{timeWindow.quota}
                        </span>
                      </div>
                    )}
                    {slotServices.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {slotServices.map((ps) => {
                          const hasUrgencia =
                            ps.service.incidencias.includes("urgencia");
                          return (
                            <div
                              key={ps.service.id}
                              className={twMerge(
                                "rounded flex items-center justify-start",
                                "text-xs font-medium truncate px-1 border-l-4 h-5",
                                hasUrgencia
                                  ? "bg-purple-100 text-purple-800 border-purple-600 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-400"
                                  : "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400"
                              )}
                              title={ps.service.id}
                            >
                              {ps.service.id}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );

                // Wrap blocked cells with Tooltip showing block names
                if (slotBlocked && !dayIsPast) {
                  return (
                    <div
                      key={`${day.dayNumber}-${slot.label}`}
                      className="w-full h-full"
                    >
                      {cellContent}
                    </div>
                  );
                }

                return cellContent;
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
