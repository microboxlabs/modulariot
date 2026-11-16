import "server-only";
import { RouteGuard } from "@/features/auth/components/route-guard";
import PlatformTemplatePage from "@/features/conversations/platform-template-page";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

/**
 * Settings › Comunicaciones › Plantillas › one template, or `NEW_TEMPLATE` to create one. Who may change it is
 * decided by the scope and the template's owner; the server checks it again on save.
 */
export default async function MessageTemplatePage({
  params,
}: Readonly<{ params: Promise<{ lang: string; key: string }> }>) {
  const { lang, key } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/communications">
      <PlatformTemplatePage templateKey={key} dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
