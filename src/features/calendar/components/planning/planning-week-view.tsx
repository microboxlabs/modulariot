"use client";

import { Fragment, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);
import { twMerge } from "tailwind-merge";
import type {
  PlanningWeekViewProps,
  TimeSlot,
  WeekDay,
} from "./planning-week-view.types";

const DAYS_IN_WORK_WEEK = 7; // Mon-Sat
const DATE_FORMAT = "YYYY-MM-DD";

function parseUrlDate(dateStr: string | null): dayjs.Dayjs | null {
  if (!dateStr) return null;
  const parsed = dayjs(dateStr, DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function generateTimeSlots(startHour: number, endHour: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push({
      hour,
      minutes: 0,
      label: `${hour.toString().padStart(2, "0")}:00`,
    });
    slots.push({
      hour,
      minutes: 30,
      label: `${hour.toString().padStart(2, "0")}:30`,
    });
  }
  return slots;
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

  const isLastDay = (idx: number) => idx === weekDays.length - 1;
  const isLastSlot = (idx: number) => idx === timeSlots.length - 1;

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
        {timeSlots.map((slot, slotIdx) => (
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
              {slot.minutes === 0 && slot.label}
            </div>

            {/* Day cells */}
            {weekDays.map((day, dayIdx) => (
              <div
                key={`${day.dayNumber}-${slot.label}`}
                className={twMerge(
                  "h-12",
                  "border-l border-t border-gray-200 dark:border-gray-700",
                  "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors",
                  isLastDay(dayIdx) && "border-r",
                  isLastSlot(slotIdx) && "border-b",
                  isLastDay(dayIdx) && isLastSlot(slotIdx) && "rounded-br-lg"
                )}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
