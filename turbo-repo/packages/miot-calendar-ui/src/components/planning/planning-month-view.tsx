"use client";

import { Fragment, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import isoWeek from "dayjs/plugin/isoWeek";
import { twMerge } from "tailwind-merge";
import type { CalendarItem } from "../../types/calendar-item";
import { useCalendar } from "../../context/calendar-provider";
import type {
  PlanningMonthViewProps,
  MonthDay,
} from "./planning-views.types";

dayjs.extend(isoWeek);

const DAYS_IN_WEEK = 7;

function getWeekdayNames(lang: string): string[] {
  const locale = lang === "es" ? "es" : "en";
  const monday = dayjs().startOf("isoWeek").locale(locale);

  return Array.from({ length: DAYS_IN_WEEK }, (_, i) =>
    monday.add(i, "day").format("ddd").toUpperCase()
  );
}

function generateMonthDays(currentDate: Date): MonthDay[] {
  const today = dayjs().startOf("day");
  const monthStart = dayjs(currentDate).startOf("month");
  const monthEnd = dayjs(currentDate).endOf("month");

  // Find the Monday of the first week that contains the month
  const calendarStart = monthStart.startOf("isoWeek");
  // Find the Sunday of the last week that contains the month
  const calendarEnd = monthEnd.endOf("isoWeek");

  const days: MonthDay[] = [];
  let current = calendarStart;

  while (current.isBefore(calendarEnd) || current.isSame(calendarEnd, "day")) {
    days.push({
      date: current.toDate(),
      dayNumber: current.date(),
      isToday: current.isSame(today, "day"),
      isCurrentMonth: current.month() === monthStart.month(),
    });
    current = current.add(1, "day");
  }

  return days;
}

export function PlanningMonthView<TItem extends { id: string } = CalendarItem>({
  lang,
  grid,
  renderDayChip,
}: Readonly<PlanningMonthViewProps<TItem>>) {
  const { currentDate, setView, setCurrentDate } = useCalendar();
  const { plannedServices } = grid;

  const weekdayNames = useMemo(() => getWeekdayNames(lang), [lang]);
  const monthDays = useMemo(
    () => generateMonthDays(currentDate),
    [currentDate]
  );

  const weeks = useMemo(() => {
    const result: MonthDay[][] = [];
    for (let i = 0; i < monthDays.length; i += DAYS_IN_WEEK) {
      result.push(monthDays.slice(i, i + DAYS_IN_WEEK));
    }
    return result;
  }, [monthDays]);

  // Get all planned services for a specific day
  const getPlannedServicesForDay = useCallback(
    (date: Date) => {
      return plannedServices.filter((ps) =>
        dayjs(ps.slot.date).isSame(date, "day")
      );
    },
    [plannedServices]
  );

  // Drill into the day view when clicking on a day. View/date are package
  // state (useCalendar); the host bridge mirrors them to the URL.
  const handleDayClick = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      setView("day");
    },
    [setCurrentDate, setView]
  );

  return (
    <div className="min-w-[600px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto">
      {/* Header row - weekday names */}
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900">
        {weekdayNames.map((dayName, idx) => (
          <div
            key={dayName}
            className={twMerge(
              "h-10 flex items-center justify-center",
              "text-xs font-medium text-gray-500 dark:text-gray-400",
              idx < 6 && "border-r border-gray-200 dark:border-gray-700"
            )}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week) => (
        <div
          key={week[0].date.toISOString()}
          className="grid grid-cols-7 border-t border-gray-200 dark:border-gray-700"
        >
          {week.map((day, dayIdx) => {
            const dayServices = getPlannedServicesForDay(day.date);

            const getDayNumberClassName = () => {
              if (day.isToday) return "bg-primary-600 text-white rounded-full";
              if (day.isCurrentMonth) return "text-gray-900 dark:text-white";
              return "text-gray-400 dark:text-gray-500";
            };

            return (
              <button
                type="button"
                key={day.date.toISOString()}
                onClick={() => handleDayClick(day.date)}
                className={twMerge(
                  "min-h-32 p-2 flex flex-col text-left",
                  "bg-white dark:bg-gray-800",
                  "transition-colors duration-200 cursor-pointer",
                  "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                  dayIdx < 6 && "border-r border-gray-200 dark:border-gray-700",
                  !day.isCurrentMonth &&
                    "bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                )}
              >
                <span
                  className={twMerge(
                    "inline-flex items-center justify-center text-sm font-medium shrink-0 w-7 h-7",
                    getDayNumberClassName()
                  )}
                >
                  {day.dayNumber}
                </span>

                {/* Planned services for this day */}
                {dayServices.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 overflow-hidden w-full">
                    {dayServices.slice(0, 3).map((ps) => (
                      <Fragment key={ps.service.id}>
                        {renderDayChip(ps)}
                      </Fragment>
                    ))}
                    {dayServices.length > 3 && (
                      <div className="flex justify-center">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                          +{dayServices.length - 3} más
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default PlanningMonthView;
