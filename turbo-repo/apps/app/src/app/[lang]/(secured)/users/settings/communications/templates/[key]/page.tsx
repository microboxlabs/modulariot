import "server-only";
import { guardPlatformOwnerPage } from "@/features/auth/access/server-access";
import PlatformTemplatePage from "@/features/conversations/platform-template-page";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

/** Settings › Comunicaciones › Plantillas › one template, or `NEW_TEMPLATE` to create one. Platform owners only. */
export default async function MessageTemplatePage({
  params,
}: Readonly<{ params: Promise<{ lang: string; key: string }> }>) {
  const { lang, key } = await params;
  await guardPlatformOwnerPage("/users/settings/communications");
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <PlatformTemplatePage templateKey={key} dict={userSettings} lang={lang} />
  );
}
