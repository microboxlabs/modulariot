import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import VitalSignsSettingsContent from "@/features/vital-signs/vital-signs-settings-content";

export default async function VitalSignsSettingsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);
  const sidebarDict = ((dict["layout"] as I18nRecord)["secured"] as I18nRecord)[
    "sidebar"
  ] as I18nRecord;

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <SectionHeader
        path={["settings", "vitalSigns"]}
        lang={lang}
        breadcrumbDict={sidebarDict}
        filterDict={dict as I18nRecord}
      />
      <VitalSignsSettingsContent />
    </div>
  );
}
