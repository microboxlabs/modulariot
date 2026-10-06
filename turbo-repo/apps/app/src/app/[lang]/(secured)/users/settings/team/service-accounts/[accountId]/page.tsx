import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import ServiceAccountPage from "@/features/settings-admin/team/service-account-page";

interface ServiceAccountRouteProps {
  readonly params: Promise<{ lang: string; accountId: string }>;
}

/** Settings › Team › one service account: module access, keys and OAuth credential. */
export default async function ServiceAccountRoute({
  params,
}: ServiceAccountRouteProps) {
  const { lang, accountId } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/team" fallbackPath={`/${lang}/shipping`}>
      <ServiceAccountPage
        dict={userSettings}
        lang={lang}
        accountId={decodeURIComponent(accountId)}
      />
    </RouteGuard>
  );
}
