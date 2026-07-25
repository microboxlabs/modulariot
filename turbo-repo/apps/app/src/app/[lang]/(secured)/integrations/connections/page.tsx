import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { IntegrationConfigPageContent } from "@/features/integration-config/components/integration-config-page-content";

export default async function IntegrationConnectionsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.integrationConnections as I18nRecord;

  return (
    <RouteGuard path="/integrations/connections" fallbackPath={`/${lang}/shipping`}>
      {/* LayoutContent is overflow-hidden — pages own their scroll (same wrapper as jobs). */}
      <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
        <IntegrationConfigPageContent dict={dict ?? {}} />
      </div>
    </RouteGuard>
  );
}
