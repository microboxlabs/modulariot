import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import OrganizationsPageContent from "@/features/settings-admin/components/organizations-page-content";

/**
 * Settings › Organizations (read-only, Phase 3).
 *
 * Lists the caller's organization scopes and, for the selected org,
 * renders the Alfresco members and enabled product modules. Data
 * flows: client-side SWR → Next.js proxy routes → Quarkus
 * /api/v1/me/scopes, /orgs/{id}/members, /orgs/{id}/modules.
 *
 * Write flows (create sub-account, add member, toggle modules) ship
 * in Phase 5.
 */
export default async function OrganizationsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/organizations"
      fallbackPath={`/${lang}/shipping`}
    >
      <OrganizationsPageContent dict={userSettings} />
    </RouteGuard>
  );
}
