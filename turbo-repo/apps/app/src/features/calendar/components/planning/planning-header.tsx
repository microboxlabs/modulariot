"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import weekOfYear from "dayjs/plugin/weekOfYear";
import type { PlanningHeaderProps } from "./planning-header.types";
import type { ViewMode } from "@/features/calendar/services/calendar.service.types";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { Button } from "flowbite-react";
import {
  CalendarNavigation,
  CalendarViewSwitcher,
} from "@microboxlabs/miot-calendar-ui";
import {
  DATE_FORMAT,
  isValidViewMode,
  parseUrlDate,
} from "@/features/calendar/services/calendar.service";
import CalendarRules, {
  getCalendarRulesMessages,
} from "./calendar-rules/calendar-rules";
import PlanningTitle from "./planning-title";
import { usePlanningSelection } from "./planning-selection-context";
import {
  updateCalendar,
  useCalendars,
} from "@/features/common/providers/client-api.provider";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import type { CalendarFilter } from "@microboxlabs/miot-calendar-client";

dayjs.extend(weekOfYear);

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
  calendarId,
  initialDate = new Date(),
  initialViewMode = "week",
  onDateChange,
  onViewModeChange,
}: Readonly<PlanningHeaderProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { andenesCount, setAndenesCount } = usePlanningSelection();
  const { calendars, refresh: refreshCalendars } = useCalendars();
  const groupCode = searchParams.get("groupCode");
  const activeCalendar = useMemo(
    () => calendars.find((c) => c.id === calendarId),
    [calendars, calendarId]
  );

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
      <PlanningTitle dict={dict} calendarId={calendarId} groupCode={groupCode} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Today Button */}
        <CalendarNavigation
          onToday={handleToday}
          todayLabel={calendarDict.today}
        />

        {/* Date Navigation: [prev] [date] [next] */}
        <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-600">
          <Button
            color="alternative"
            size="sm"
            onClick={handlePrev}
            className="rounded-r-none border-0"
          >
            <HiChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[180px] text-center capitalize border-x border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
            {formatDateDisplay(currentDate, viewMode, lang)}
          </span>
          <Button
            color="alternative"
            size="sm"
            onClick={handleNext}
            className="rounded-l-none border-0"
          >
            <HiChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
        <CalendarRules
          dict={dict}
          messages={getCalendarRulesMessages(dict)}
          andenesCount={andenesCount}
          taskFilter={activeCalendar?.filter}
          onAndenesChange={async (config) => {
            setAndenesCount(config.count);
            if (!calendarId) return;
            try {
              await updateCalendar(calendarId, { parallelism: config.count });
              await refreshCalendars();
              ShowNotification({
                type: "success",
                message: tr("layout.planning.calendarRules.platformConfig.saveSuccess", dict),
              });
            } catch {
              ShowNotification({
                type: "error",
                message: tr("layout.planning.calendarRules.platformConfig.saveError", dict),
              });
            }
          }}
          onTaskFilterChange={async (filter: CalendarFilter) => {
            if (!calendarId) return;
            try {
              await updateCalendar(calendarId, { filter });
              await refreshCalendars();
              ShowNotification({
                type: "success",
                message: tr("layout.planning.calendarRules.taskFilter.saveSuccess", dict),
              });
            } catch {
              ShowNotification({
                type: "error",
                message: tr("layout.planning.calendarRules.taskFilter.saveError", dict),
              });
            }
          }}
        />
      </div>
    </div>
  );
}
