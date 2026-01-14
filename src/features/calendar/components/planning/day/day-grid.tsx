"use client";

import { Fragment, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import { twMerge } from "tailwind-merge";
import type { DayInfo } from "../planning-day-view.types";
import { generateTimeSlots } from "@/features/calendar/services/calendar.service";
import { usePlanningSelection } from "../planning-selection-context";

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
  const { selectedSlot, selectSlot } = usePlanningSelection();

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour),
    [startHour, endHour]
  );

  const dayInfo = useMemo(
    () => getDayInfo(currentDate, lang),
    [currentDate, lang]
  );

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
          return (
            <Fragment key={slot.label}>
              {/* Time label column */}
              <div
                className={twMerge(
                  "h-16 flex items-start justify-end pr-2 pt-0.5",
                  "border-l border-t border-gray-200 dark:border-gray-700",
                  "text-xs text-gray-500 dark:text-gray-400",
                  isLastSlot(slotIdx) && "border-b rounded-bl-lg"
                )}
              >
                {slot.minutes === 0 && slot.label}
              </div>

              {/* Day cell - clickable */}
              <button
                type="button"
                onClick={() => handleCellClick(slot)}
                className={twMerge(
                  "h-16 w-full",
                  "border-l border-t border-r border-gray-200 dark:border-gray-700",
                  "transition-all duration-200 cursor-pointer",
                  selected
                    ? "bg-primary-100 dark:bg-primary-900/40 ring-2 ring-inset ring-primary-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                  isLastSlot(slotIdx) && "border-b rounded-br-lg"
                )}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
