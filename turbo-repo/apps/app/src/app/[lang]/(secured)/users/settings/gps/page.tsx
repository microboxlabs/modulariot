import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import GpsIntegrationPage from "@/features/settings-admin/gps/gps-integration-page";

/** Settings › GPS: how the organization's GPS provider sends positions. */
export default async function GpsSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/gps" fallbackPath={`/${lang}/shipping`}>
      <GpsIntegrationPage dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
