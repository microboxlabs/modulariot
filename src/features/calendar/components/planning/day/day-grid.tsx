"use client";

import { Fragment, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { twMerge } from "tailwind-merge";
import type { DayInfo } from "../planning-day-view.types";
import { generateTimeSlots } from "@/features/calendar/services/calendar.service";
import {
  usePlanningSelection,
  TIME_WINDOW_COLORS,
  TimeWindowUtils,
} from "../planning-selection-context";

interface DayGridProps {
  lang: string;
  currentDate: Date;
  startHour?: number;
  endHour?: number;
}

function getDayInfo(date: Date, lang: string): DayInfo {
  const locale = lang === "es" ? "es" : "en";
  const d = dayjs(date).locale(locale);
  const today = dayjs().startOf("day");

  return {
    date,
    dayName: d.format("dddd"),
    dayNumber: d.date(),
    monthName: d.format("MMMM"),
    year: d.year(),
    isToday: d.isSame(today, "day"),
  };
}

export default function DayGrid({
  lang,
  currentDate,
  startHour = 8,
  endHour = 22,
}: Readonly<DayGridProps>) {
  const {
    selectedSlot,
    selectSlot,
    plannedServices,
    getTimeWindowForSlot,
    getRemainingQuota,
  } = usePlanningSelection();

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour),
    [startHour, endHour]
  );

  const dayInfo = useMemo(
    () => getDayInfo(currentDate, lang),
    [currentDate, lang]
  );

  // Check if the current day is in the past
  const isPastDay = useMemo(() => {
    return dayjs(currentDate).isBefore(dayjs().startOf("day"), "day");
  }, [currentDate]);

  const isLastSlot = (idx: number) => idx === timeSlots.length - 1;

  const handleCellClick = useCallback(
    (slot: { hour: number; minutes: number }) => {
      selectSlot({
        date: currentDate,
        hour: slot.hour,
        minutes: slot.minutes,
      });
    },
    [selectSlot, currentDate]
  );

  const isSlotSelected = useCallback(
    (slot: { hour: number; minutes: number }) => {
      if (!selectedSlot) return false;
      return (
        dayjs(selectedSlot.date).isSame(currentDate, "day") &&
        selectedSlot.hour === slot.hour &&
        selectedSlot.minutes === slot.minutes
      );
    },
    [selectedSlot, currentDate]
  );

  const getPlannedServicesForSlot = useCallback(
    (slot: { hour: number; minutes: number }) => {
      return plannedServices.filter(
        (ps) =>
          dayjs(ps.slot.date).isSame(currentDate, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
      );
    },
    [plannedServices, currentDate]
  );

  return (
    <div className="w-full h-full overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}>
        {/* Header row - empty corner cell */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div className="h-20 border-l border-t border-gray-200 dark:border-gray-700 rounded-tl-lg bg-gray-50 dark:bg-gray-900" />
        </div>

        {/* Header row - day column */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <div
            className={twMerge(
              "h-20 flex flex-col items-center justify-center",
              "border-l border-t border-r border-gray-200 dark:border-gray-700",
              "bg-gray-50 dark:bg-gray-900 rounded-tr-lg"
            )}
          >
            <span
              className={twMerge(
                "text-sm font-medium capitalize",
                dayInfo.isToday
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {dayInfo.dayName}
            </span>
            <span
              className={twMerge(
                "text-2xl font-bold",
                dayInfo.isToday
                  ? "bg-primary-600 text-white rounded-full w-10 h-10 flex items-center justify-center"
                  : "text-gray-900 dark:text-white"
              )}
            >
              {dayInfo.dayNumber}
            </span>
          </div>
        </div>

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIdx) => {
          const selected = isSlotSelected(slot);
          const slotServices = getPlannedServicesForSlot(slot);
          const timeWindow = getTimeWindowForSlot(
            currentDate,
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
            ? getRemainingQuota(timeWindow, currentDate)
            : 0;
          const isQuotaFull = remainingQuota === 0;
          const isDailyOverride =
            hasTimeWindow && timeWindow.type === "daily-override";
          const isDisabled = isPastDay || isQuotaFull;
          // Get color classes from the time window
          const windowColor =
            hasTimeWindow && timeWindow.color
              ? TIME_WINDOW_COLORS[timeWindow.color]
              : TIME_WINDOW_COLORS.emerald;

          return (
            <Fragment key={slot.label}>
              {/* Time label column */}
              <div
                className={twMerge(
                  "h-12 flex items-start justify-end pr-2 pt-0.5",
                  "border-l border-t border-gray-200 dark:border-gray-700",
                  "text-xs text-gray-500 dark:text-gray-400",
                  isLastSlot(slotIdx) && "border-b rounded-bl-lg"
                )}
              >
                {slot.label}
              </div>

              {/* Day cell - clickable */}
              <button
                type="button"
                onClick={() => !isDisabled && handleCellClick(slot)}
                disabled={isDisabled}
                className={twMerge(
                  "h-12 w-full relative",
                  "border-l border-t border-r border-gray-200 dark:border-gray-700",
                  "transition-all duration-200 p-1",
                  isPastDay && "bg-gray-100 dark:bg-gray-900/50 opacity-50",
                  isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                  !isPastDay && isQuotaFull && "opacity-60",
                  // Time window with custom color (not full, not selected, not past)
                  !isPastDay &&
                    hasTimeWindow &&
                    !selected &&
                    !isQuotaFull &&
                    windowColor.bg,
                  // Quota full - show red
                  !isPastDay &&
                    hasTimeWindow &&
                    !selected &&
                    isQuotaFull &&
                    "bg-red-50 dark:bg-red-900/20",
                  selected
                    ? "bg-primary-100 dark:bg-primary-900/40 ring-2 ring-inset ring-primary-500"
                    : !isPastDay &&
                        !hasTimeWindow &&
                        "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                  !isPastDay &&
                    hasTimeWindow &&
                    !selected &&
                    !isQuotaFull &&
                    windowColor.hover,
                  isLastSlot(slotIdx) && "border-b rounded-br-lg"
                )}
                title={
                  isPastDay
                    ? "Día pasado"
                    : hasTimeWindow
                      ? isQuotaFull
                        ? `${timeWindow.name || (isDailyOverride ? "Excepción" : "Ventana")} - Sin cupos disponibles`
                        : `${timeWindow.name || (isDailyOverride ? "Excepción" : "Ventana")} - Cupos restantes: ${remainingQuota}/${timeWindow.quota}`
                      : undefined
                }
              >
                {/* Time window name - only on first slot and not past day */}
                {!isPastDay && isWindowStart && timeWindow.name && (
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
                {/* Quota badge - only on first slot and not past day */}
                {!isPastDay && isWindowStart && (
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
                  <div className="absolute inset-1 flex flex-row gap-0.5">
                    {slotServices.map((ps) => {
                      const hasUrgencia =
                        ps.service.incidencias.includes("urgencia");
                      return (
                        <div
                          key={ps.service.id}
                          className={twMerge(
                            "flex-1 rounded flex items-center justify-start",
                            "text-xs font-medium truncate px-1 border-l-4",
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
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
