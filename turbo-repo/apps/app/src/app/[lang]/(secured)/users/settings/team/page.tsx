import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import TeamPageContent from "@/features/settings-admin/team/team-page-content";

/** Settings › Team: members, invitations and roles of the active organization. */
export default async function TeamSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/team" fallbackPath={`/${lang}/shipping`}>
      <TeamPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
