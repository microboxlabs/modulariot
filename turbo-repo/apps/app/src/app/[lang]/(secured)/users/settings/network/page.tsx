import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import NetworkPage from "@/features/settings-admin/network/network-page";

/** Settings › Asset network: the organization's assets and who it shares them with. */
export default async function NetworkSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/network"
      fallbackPath={`/${lang}/shipping`}
    >
      <NetworkPage dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
