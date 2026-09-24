import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import ContactBookPageContent from "@/features/settings-admin/components/contact-book-page-content";

/**
 * PROTOTYPE — Settings › Libreta de contactos.
 *
 * System-wide directory of people the call-center's "who to call" picker
 * searches. Client-only persistence for now (no backend).
 */
export default async function ContactBookSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/contact-book"
      fallbackPath={`/${lang}/shipping`}
    >
      <ContactBookPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
