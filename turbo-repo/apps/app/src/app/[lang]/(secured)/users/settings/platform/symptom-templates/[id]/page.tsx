import "server-only";
import { guardPlatformOwnerPage } from "@/features/auth/access/server-access";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { isHarnessUiEnabled } from "@/features/layout/utils/utils";
import SymptomDetail from "@/features/symptoms/maintainer/symptom-detail";
import { PlatformTemplatesScope } from "@/features/symptoms/maintainer/symptom-scope";

/** Settings › Plataforma › Plantillas de síntomas › one template, in the symptom editor. */
export default async function SymptomTemplatePage({
  params,
}: Readonly<{ params: Promise<{ lang: string; id: string }> }>) {
  const { lang, id } = await params;
  await guardPlatformOwnerPage("/users/settings/platform/symptom-templates");
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <PlatformTemplatesScope>
      <SymptomDetail
        id={id}
        dict={userSettings}
        rootDict={dictionary as I18nRecord}
        lang={lang}
        harnessEnabled={isHarnessUiEnabled()}
      />
    </PlatformTemplatesScope>
  );
}
