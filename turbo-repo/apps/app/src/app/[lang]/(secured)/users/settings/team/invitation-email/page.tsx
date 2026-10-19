import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import InvitationEmailPage from "@/features/settings-admin/mail-templates/invitation-email-page";

/** Settings › Team › invitation email: the organization's invitation template. */
export default async function TeamInvitationEmailPage({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/team" fallbackPath={`/${lang}/shipping`}>
      <InvitationEmailPage dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
