import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import MemberAccessPage from "@/features/settings-admin/team/member-access-page";

interface MemberPageProps {
  readonly params: Promise<{ lang: string; userId: string }>;
}

/** Settings › Team › one member: base role, module roles and resulting permissions. */
export default async function TeamMemberPage({ params }: MemberPageProps) {
  const { lang, userId } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/team" fallbackPath={`/${lang}/shipping`}>
      <MemberAccessPage dict={userSettings} lang={lang} userId={userId} />
    </RouteGuard>
  );
}
