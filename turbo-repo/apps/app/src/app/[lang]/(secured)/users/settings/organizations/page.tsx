import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import OrganizationsPageContent from "@/features/settings-admin/components/organizations-page-content";

/** Organization roster for members and owner-only settings controls. */
export default async function OrganizationsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/organizations"
      fallbackPath={`/${lang}/shipping`}
    >
      <OrganizationsPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
