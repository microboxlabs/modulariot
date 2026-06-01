"use client";

import type { CalendarItem } from "../../types/calendar-item";
import { useCalendar } from "../../context/calendar-provider";
import { DayGrid } from "./day/day-grid";
import type { PlanningDayViewProps } from "./planning-views.types";

/**
 * Single-day planning view. The active date comes from the package calendar
 * state (`useCalendar()`); the host syncs URL ↔ state outside the package.
 */
export function PlanningDayView<TItem extends { id: string } = CalendarItem>({
  lang,
  grid,
  buildShellProps,
  startHour = 8,
  endHour = 22,
}: Readonly<PlanningDayViewProps<TItem>>) {
  const { currentDate } = useCalendar();

  return (
    <div className="h-full">
      <DayGrid<TItem>
        lang={lang}
        currentDate={currentDate}
        grid={grid}
        buildShellProps={buildShellProps}
        startHour={startHour}
        endHour={endHour}
      />
    </div>
  );
}

export default PlanningDayView;
