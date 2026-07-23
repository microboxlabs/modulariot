import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import CredentialsPageContent from "@/features/credentials/components/credentials-page-content";

/**
 * Settings › Credentials — UI MOCKUP.
 *
 * Reusable credentials (configure once, reference from data sources,
 * integrations and jobs), starting with Azure Entra client credentials.
 * The screen runs on local fixtures until the credentials API exists.
 */
export default async function CredentialsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/credentials"
      fallbackPath={`/${lang}/shipping`}
    >
      <CredentialsPageContent
        dict={userSettings}
        rootDict={dictionary as unknown as I18nRecord}
      />
    </RouteGuard>
  );
}
