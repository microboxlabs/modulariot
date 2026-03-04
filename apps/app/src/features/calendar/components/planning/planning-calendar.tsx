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

  // Read slot duration from URL for testing (default: 30 minutes)
  const slotDurationMinutes = useMemo(() => {
    const urlDuration = searchParams.get("slotDuration");
    if (!urlDuration) return 30;
    const parsed = Number.parseInt(urlDuration, 10);
    return Number.isNaN(parsed) || parsed < 5 || parsed > 480 ? 30 : parsed;
  }, [searchParams]);

  switch (viewMode) {
    case "day":
      return <PlanningDayView lang={lang} dict={dict} slotDurationMinutes={slotDurationMinutes} />;
    case "week":
      return <PlanningWeekView lang={lang} dict={dict} slotDurationMinutes={slotDurationMinutes} />;
    case "month":
      return <PlanningMonthView lang={lang} dict={dict} />;
    default:
      return <PlanningWeekView lang={lang} dict={dict} slotDurationMinutes={slotDurationMinutes} />;
  }
}
