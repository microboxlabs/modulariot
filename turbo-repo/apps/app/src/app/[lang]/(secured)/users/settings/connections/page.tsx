import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { IntegrationConfigPageContent } from "@/features/integration-config/components/integration-config-page-content";

/**
 * Settings › Connections.
 *
 * Integration templates (the reusable types) and the connections created from them.
 * Sits beside Credentials because it configures the other half of the same thing: a
 * credential is the secret, a connection is the endpoint that secret is pointed at.
 */
export default async function IntegrationConnectionsPage({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const pages = dictionary.pages as I18nRecord;
  const dict = pages?.integrationConnections as I18nRecord;
  const breadcrumbDict = (pages?.userSettings as I18nRecord)
    ?.breadcrumb as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/connections"
      fallbackPath={`/${lang}/shipping`}
    >
      <IntegrationConfigPageContent
        dict={dict ?? {}}
        breadcrumbDict={breadcrumbDict ?? {}}
        lang={lang}
      />
    </RouteGuard>
  );
}
