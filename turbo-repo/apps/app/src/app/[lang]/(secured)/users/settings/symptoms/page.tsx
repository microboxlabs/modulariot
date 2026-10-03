import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { isHarnessUiEnabled } from "@/features/layout/utils/utils";
import SymptomCatalog from "@/features/symptoms/maintainer/symptom-catalog";

/** Settings › Síntomas: the organization's symptoms on the Control Tower API. */
export default async function SymptomsSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/symptoms"
      fallbackPath={`/${lang}/shipping`}
    >
      <SymptomCatalog
        dict={userSettings}
        rootDict={dictionary as I18nRecord}
        lang={lang}
        harnessEnabled={isHarnessUiEnabled()}
      />
    </RouteGuard>
  );
}
