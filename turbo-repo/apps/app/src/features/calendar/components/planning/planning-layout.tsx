import "server-only";

import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import PlanningHeader from "./planning-header";
import PlanningCalendar from "./planning-calendar";
import { PlanningLayoutClient } from "./planning-layout-client";

interface PlanningLayoutProps {
  lang: string;
  dict: I18nDictionary;
  calendarId?: string;
}

export default function PlanningLayout({
  lang,
  dict,
  calendarId,
}: Readonly<PlanningLayoutProps>) {
  return (
    <PlanningLayoutClient
      dict={dict}
      calendarId={calendarId}
      header={<PlanningHeader lang={lang} dict={dict} calendarId={calendarId} />}
      calendar={<PlanningCalendar lang={lang} dict={dict} />}
    />
  );
}
