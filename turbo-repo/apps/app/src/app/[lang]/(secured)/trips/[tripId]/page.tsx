import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import type {
  I18nRecord,
  ParamsWithLang,
} from "@/features/i18n/i18n.service.types";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
import TripSheet from "@/features/trips/sheet/trip-sheet";

export default async function TripPage({
  params,
}: ParamsWithLang<{ tripId: string }>) {
  const { lang, tripId } = await params;
  await guardPage(ACCESS_RULES.trips, `/trips/${tripId}`);
  const [, dictionary] = await getDictionary(lang);
  const d = (dictionary.pages as I18nRecord)?.tripsBoard as I18nRecord;
  return <TripSheet tripId={tripId} lang={lang} d={d} general={dictionary} />;
}
