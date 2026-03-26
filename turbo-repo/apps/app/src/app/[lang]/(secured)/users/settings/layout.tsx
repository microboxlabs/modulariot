import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { SettingsSidebar } from "@/features/data-sources/components/settings-sidebar";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
} & ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;
  const navDict = userSettings?.settingsNav as I18nRecord;

  return (
    <div className="flex h-full w-full">
      <SettingsSidebar dict={navDict} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
