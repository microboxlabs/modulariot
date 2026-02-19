import { HiCalendar, HiCog, HiCollection } from "react-icons/hi";
import { tr } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { CalendarFeatureCard } from "./calendar-feature-card";
import { CreateCalendarButton } from "./create-calendar-button";

interface CalendarLandingProps {
  dict: I18nRecord;
  lang: string;
}

export function CalendarLanding({ dict }: Readonly<CalendarLandingProps>) {
  const landing = dict.landing as I18nRecord;

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
        <HiCalendar className="h-12 w-12 text-blue-500" />
      </div>

      <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
        {tr("title", landing)}
      </h1>

      <p className="mb-12 max-w-lg text-center text-gray-500 dark:text-gray-400">
        {tr("subtitle", landing)}
      </p>

      <div className="mb-12 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        <CalendarFeatureCard
          icon={<HiCalendar className="h-6 w-6 text-blue-500" />}
          title={tr("planning_title", landing)}
          description={tr("planning_description", landing)}
        />
        <CalendarFeatureCard
          icon={<HiCog className="h-6 w-6 text-blue-500" />}
          title={tr("rules_title", landing)}
          description={tr("rules_description", landing)}
        />
        <CalendarFeatureCard
          icon={<HiCollection className="h-6 w-6 text-blue-500" />}
          title={tr("multi_calendar_title", landing)}
          description={tr("multi_calendar_description", landing)}
        />
      </div>

      <CreateCalendarButton dict={dict} ctaLabel={tr("cta", landing)} />
    </div>
  );
}
