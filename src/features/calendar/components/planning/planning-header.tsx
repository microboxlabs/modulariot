"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import weekOfYear from "dayjs/plugin/weekOfYear";
import type { PlanningHeaderProps, ViewMode } from "./planning-header.types";
import { CalendarNavigation } from "./calendar-navigation";
import { CalendarViewSwitcher } from "./calendar-view-switcher";

dayjs.extend(weekOfYear);

const VIEW_MODES: ViewMode[] = ["day", "week", "month"];
const DATE_FORMAT = "YYYY-MM-DD";

function isValidViewMode(value: string | null): value is ViewMode {
  return value !== null && VIEW_MODES.includes(value as ViewMode);
}

function parseUrlDate(dateStr: string | null): dayjs.Dayjs | null {
  if (!dateStr) return null;
  const parsed = dayjs(dateStr, DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function getLocaleCode(lang: string): string {
  return lang === "es" ? "es" : "en";
}

function formatDateDisplay(
  date: dayjs.Dayjs,
  viewMode: ViewMode,
  lang: string
): string {
  const locale = getLocaleCode(lang);
  switch (viewMode) {
    case "day":
      return date.locale(locale).format("dddd, D [de] MMMM YYYY");
    case "week": {
      const weekStart = date.startOf("week");
      const weekEnd = date.endOf("week");
      return `${weekStart.locale(locale).format("D")} - ${weekEnd.locale(locale).format("D MMMM YYYY")}`;
    }
    case "month":
      return date.locale(locale).format("MMMM YYYY");
  }
}

function navigateDate(
  date: dayjs.Dayjs,
  viewMode: ViewMode,
  direction: 1 | -1
): dayjs.Dayjs {
  switch (viewMode) {
    case "day":
      return date.add(direction, "day");
    case "week":
      return date.add(direction, "week");
    case "month":
      return date.add(direction, "month");
  }
}

export default function PlanningHeader({
  lang,
  dict,
  initialDate = new Date(),
  initialViewMode = "week",
  onDateChange,
  onViewModeChange,
}: PlanningHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read state from URL, fallback to props/defaults
  const currentDate = useMemo(() => {
    const urlDate = parseUrlDate(searchParams.get("date"));
    return urlDate ?? dayjs(initialDate);
  }, [searchParams, initialDate]);

  const viewMode = useMemo(() => {
    const urlView = searchParams.get("view");
    return isValidViewMode(urlView) ? urlView : initialViewMode;
  }, [searchParams, initialViewMode]);

  // Update URL with new params
  const updateUrl = useCallback(
    (date: dayjs.Dayjs, view: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date.format(DATE_FORMAT));
      params.set("view", view);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const calendarDict = dict.layout?.calendar ?? {
    today: "Today",
    day: "Day",
    week: "Week",
    month: "Month",
  };

  const handlePrev = () => {
    const newDate = navigateDate(currentDate, viewMode, -1);
    updateUrl(newDate, viewMode);
    onDateChange?.(newDate.toDate());
  };

  const handleNext = () => {
    const newDate = navigateDate(currentDate, viewMode, 1);
    updateUrl(newDate, viewMode);
    onDateChange?.(newDate.toDate());
  };

  const handleToday = () => {
    const today = dayjs();
    updateUrl(today, viewMode);
    onDateChange?.(today.toDate());
  };

  const handleViewModeChange = (mode: ViewMode) => {
    updateUrl(currentDate, mode);
    onViewModeChange?.(mode);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Title */}
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {dict.layout?.secured?.sidebar?.planning ?? "Planificación"}
      </h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Navigation */}
        <CalendarNavigation
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          todayLabel={calendarDict.today}
        />

        {/* Current Date Display */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[180px] text-center capitalize">
          {formatDateDisplay(currentDate, viewMode, lang)}
        </span>

        {/* View Switcher */}
        <CalendarViewSwitcher
          activeView={viewMode}
          onViewChange={handleViewModeChange}
          labels={{
            day: calendarDict.day,
            week: calendarDict.week,
            month: calendarDict.month,
          }}
        />
      </div>
    </div>
  );
}
