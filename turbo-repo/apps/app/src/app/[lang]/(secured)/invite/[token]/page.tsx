import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { AcceptInvitation } from "@/features/settings-admin/team/accept-invitation";

interface InvitePageProps {
  readonly params: Promise<{ lang: string; token: string }>;
}

/** The invitation link: the signed-in user accepts it with their email. */
export default async function InvitePage({ params }: InvitePageProps) {
  const { lang, token } = await params;
  const [, dictionary] = await getDictionary(lang);
  const team = ((dictionary.pages as I18nRecord)?.userSettings as I18nRecord)
    ?.team as I18nRecord;
  return <AcceptInvitation token={token} lang={lang} d={team} />;
}
