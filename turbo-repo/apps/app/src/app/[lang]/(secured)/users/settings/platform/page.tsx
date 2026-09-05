import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import PlatformPageContent from "@/features/settings-admin/platform/platform-page-content";

/** Platform-scope settings: per-domain branding and who may administer it. */
export default async function PlatformSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/platform"
      fallbackPath={`/${lang}/shipping`}
    >
      <PlatformPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
