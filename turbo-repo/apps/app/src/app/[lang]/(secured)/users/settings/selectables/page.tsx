import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import SelectablesPageContent from "@/features/settings-admin/components/selectables-page-content";

/**
 * Settings › Selectables.
 *
 * Maintainer for the reusable option lists that back the treatment-form
 * selectors, stored per organization by the modulith core selectables API.
 */
export default async function SelectablesSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/selectables"
      fallbackPath={`/${lang}/shipping`}
    >
      <SelectablesPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
