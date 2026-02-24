import "server-only";

import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import PlanningLayout from "./planning-layout";

interface PlanningProps {
  lang: string;
  dict: I18nDictionary;
  calendarId?: string;
}

export default function Planning({ lang, dict, calendarId }: Readonly<PlanningProps>) {
  return <PlanningLayout lang={lang} dict={dict} calendarId={calendarId} />;
}
