import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
import type { BoardViewKey } from "./board-api";
import TripsBoard from "./trips-board";

/** The server page of one board view: access check and dictionaries. */
export async function TripsBoardPage({
  view,
  lang,
}: Readonly<{ view: BoardViewKey; lang: string }>) {
  await guardPage(ACCESS_RULES.trips, `/trips/${view}`);
  const [, dictionary] = await getDictionary(lang);
  const d = (dictionary.pages as I18nRecord)?.tripsBoard as I18nRecord;
  return <TripsBoard view={view} lang={lang} d={d} general={dictionary} />;
}
