"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import type { PlanningDayViewProps } from "./planning-day-view.types";
import DayGrid from "./day/day-grid";

const DATE_FORMAT = "YYYY-MM-DD";

function parseUrlDate(dateStr: string | null): dayjs.Dayjs | null {
  if (!dateStr) return null;
  const parsed = dayjs(dateStr, DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

export default function PlanningDayView({
  lang,
  dict,
  currentDate: propDate,
  startHour = 8,
  endHour = 22,
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
      />
    </div>
  );
}
