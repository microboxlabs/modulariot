import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import DataSourcesPageContent from "@/features/data-sources/components/data-sources-page-content";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
import { auth } from "@/auth";

export default async function DataSourcesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const session = await auth();

  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  // Data sources are scoped per user until proper org context is available.
  // session.user.id is the Auth0 sub (typically the user's email).
  // TODO: Replace with real org ID once org membership is wired into the app.
  const orgId = session?.user?.email ?? session?.user?.id ?? "";

  try {
    return (
      <RouteGuard
        path="/users/settings/data-sources"
        fallbackPath={`/${lang}/shipping`}
      >
        <DataSourcesPageContent dict={userSettings} orgId={orgId} />
      </RouteGuard>
    );
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 401) {
      redirectWithLang("/sign-in");
    }
  }
  return null;
}
