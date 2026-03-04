"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { PlanningDayViewProps } from "./planning-day-view.types";
import DayGrid from "./day/day-grid";
import { parseUrlDate } from "@/features/calendar/services/calendar.service";

export default function PlanningDayView({
  lang,
  dict,
  currentDate: propDate,
  startHour = 8,
  endHour = 22,
  slotDurationMinutes = 30,
}: Readonly<PlanningDayViewProps>) {
  const searchParams = useSearchParams();

  // Read date from URL, fallback to prop or today
  const currentDate = useMemo(() => {
    const urlDate = parseUrlDate(searchParams.get("date"));
    if (urlDate) return urlDate.toDate();
    if (propDate) return propDate;
    return new Date();
  }, [searchParams, propDate]);

  return (
    <div className="h-full">
      <DayGrid
        lang={lang}
        dict={dict}
        currentDate={currentDate}
        startHour={startHour}
        endHour={endHour}
        slotDurationMinutes={slotDurationMinutes}
      />
    </div>
  );
}
