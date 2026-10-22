import "server-only";
import { guardPlatformOwnerPage } from "@/features/auth/access/server-access";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { isHarnessUiEnabled } from "@/features/layout/utils/utils";
import SymptomCatalog from "@/features/symptoms/maintainer/symptom-catalog";
import { PlatformTemplatesScope } from "@/features/symptoms/maintainer/symptom-scope";

/** Settings › Plataforma › Plantillas de síntomas: the symptom catalog on the platform's templates. */
export default async function SymptomTemplatesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  await guardPlatformOwnerPage("/users/settings/platform/symptom-templates");
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <PlatformTemplatesScope>
      <SymptomCatalog
        dict={userSettings}
        rootDict={dictionary as I18nRecord}
        lang={lang}
        harnessEnabled={isHarnessUiEnabled()}
      />
    </PlatformTemplatesScope>
  );
}
