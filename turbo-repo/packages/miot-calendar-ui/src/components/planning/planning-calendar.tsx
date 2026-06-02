"use client";

import type { CalendarItem } from "../../types/calendar-item";
import { useCalendar } from "../../context/calendar-provider";
import { PlanningDayView } from "./planning-day-view";
import { PlanningWeekView } from "./planning-week-view";
import { PlanningMonthView } from "./planning-month-view";
import type { PlanningCalendarProps } from "./planning-views.types";

/**
 * Switches between the day/week/month planning views based on the active view
 * in the package calendar state (`useCalendar()`). The host injects the
 * domain-bound grid controller + shell-props builder (day/week) and the
 * day-cell chip renderer (month); the host bridge owns URL ↔ state sync.
 */
export function PlanningCalendar<TItem extends { id: string } = CalendarItem>({
  lang,
  grid,
  buildShellProps,
  renderDayChip,
  startHour,
  endHour,
}: Readonly<PlanningCalendarProps<TItem>>) {
  const { view } = useCalendar();

  switch (view) {
    case "day":
      return (
        <PlanningDayView<TItem>
          lang={lang}
          grid={grid}
          buildShellProps={buildShellProps}
          startHour={startHour}
          endHour={endHour}
        />
      );
    case "month":
      return (
        <PlanningMonthView<TItem>
          lang={lang}
          grid={grid}
          renderDayChip={renderDayChip}
        />
      );
    case "week":
    default:
      return (
        <PlanningWeekView<TItem>
          lang={lang}
          grid={grid}
          buildShellProps={buildShellProps}
          startHour={startHour}
          endHour={endHour}
        />
      );
  }
}

export default PlanningCalendar;
