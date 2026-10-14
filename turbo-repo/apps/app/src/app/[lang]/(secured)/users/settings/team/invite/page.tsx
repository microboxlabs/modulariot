import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import InviteMembersPage from "@/features/settings-admin/team/invite-members-page";

interface InvitePageProps {
  readonly params: Promise<{ lang: string }>;
}

/** Settings › Team › invite members. */
export default async function InvitePage({ params }: InvitePageProps) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/team" fallbackPath={`/${lang}/shipping`}>
      <InviteMembersPage dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
