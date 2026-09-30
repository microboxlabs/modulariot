import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import SymptomDetail from "@/features/symptoms/maintainer/symptom-detail";

/** Settings › Síntomas › one symptom. */
export default async function SymptomSettingsPage({
  params,
}: Readonly<{ params: Promise<{ lang: string; id: string }> }>) {
  const { lang, id } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/symptoms"
      fallbackPath={`/${lang}/shipping`}
    >
      <SymptomDetail
        id={id}
        dict={userSettings}
        rootDict={dictionary as I18nRecord}
        lang={lang}
      />
    </RouteGuard>
  );
}
