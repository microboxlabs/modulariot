import "server-only";
import { guardPlatformOwnerPage } from "@/features/auth/access/server-access";
import PlatformTemplatesCatalog from "@/features/conversations/platform-templates-catalog";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";

/** Settings › Plataforma › Plantillas de mensajes: the templates every organization's rules send. */
export default async function MessageTemplatesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  await guardPlatformOwnerPage("/users/settings/platform/message-templates");
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return <PlatformTemplatesCatalog dict={userSettings} lang={lang} />;
}
