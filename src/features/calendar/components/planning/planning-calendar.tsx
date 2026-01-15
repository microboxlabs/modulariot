"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import PlanningWeekView from "./planning-week-view";
import PlanningDayView from "./planning-day-view";
import PlanningMonthView from "./planning-month-view";
import { isValidViewMode } from "@/features/calendar/services/calendar.service";

interface PlanningCalendarProps {
  lang: string;
  dict: I18nDictionary;
}

export default function PlanningCalendar({
  lang,
  dict,
}: Readonly<PlanningCalendarProps>) {
  const searchParams = useSearchParams();

  const viewMode = useMemo(() => {
    const urlView = searchParams.get("view");
    return isValidViewMode(urlView) ? urlView : "week";
  }, [searchParams]);

  switch (viewMode) {
    case "day":
      return <PlanningDayView lang={lang} />;
    case "week":
      return <PlanningWeekView lang={lang} dict={dict} />;
    case "month":
      return <PlanningMonthView lang={lang} dict={dict} />;
    default:
      return <PlanningWeekView lang={lang} dict={dict} />;
  }
}
