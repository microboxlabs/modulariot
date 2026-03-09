import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import DataSourcesPageContent from "@/features/data-sources/components/data-sources-page-content";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
import { auth } from "@/auth";
import { getUserSites } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export default async function DataSourcesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const session = await auth();

  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  // Resolve siteId from the user's Alfresco site membership
  const sites = session ? await getUserSites(session) : [];
  const siteId = sites[0]?.shortName ?? "";

  try {
    return (
      <RouteGuard
        path="/users/settings/data-sources"
        fallbackPath={`/${lang}/shipping`}
      >
        <DataSourcesPageContent dict={userSettings} siteId={siteId} />
      </RouteGuard>
    );
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 401) {
      redirectWithLang("/sign-in");
    }
  }
  return null;
}
