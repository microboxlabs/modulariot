import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import TeamAccessPage from "@/features/settings-admin/team/team-access-page";

interface TeamPageProps {
  readonly params: Promise<{ lang: string; teamId: string }>;
}

/** Settings › Team › one team: members, module roles and resulting permissions. */
export default async function TeamDetailPage({ params }: TeamPageProps) {
  const { lang, teamId } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/team">
      <TeamAccessPage dict={userSettings} lang={lang} teamId={teamId} />
    </RouteGuard>
  );
}
