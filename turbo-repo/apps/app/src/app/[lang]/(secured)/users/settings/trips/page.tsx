import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import MonitorList from "@/features/trips/monitors/monitor-list";

/** Settings › Viajes: the organization's trip monitors, each with the trips it takes. */
export default async function TripsSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/trips">
      <MonitorList dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
