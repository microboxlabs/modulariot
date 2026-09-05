import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import BrandingPageContent from "@/features/settings-admin/platform/branding-page-content";

/** Per-domain logos and the platform owners who may set them. */
export default async function BrandingSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/branding"
      fallbackPath={`/${lang}/shipping`}
    >
      <BrandingPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
