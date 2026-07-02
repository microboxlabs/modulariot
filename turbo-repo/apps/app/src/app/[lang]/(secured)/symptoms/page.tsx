import { HiClipboardList } from "react-icons/hi";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ClientSymptoms from "../../../../features/symptoms/client-symptoms";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";

export default async function SymptomsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);
  return (
    <RouteGuard path="/symptoms" fallbackPath={`/${lang}/shipping`}>
      <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
        <SectionHeader
          path={["mission_control", "symptoms"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          breadcrumbDict={dict["symptoms"] as I18nRecord}
          filterDict={dict as I18nRecord}
        />
        {/* 
          The reason of why there is no padding here but in the individual elements inside, is because the
          animation of hiding the cards is not working if there is padding.
        */}
        <ClientSymptoms dict={dict} />
      </div>
    </RouteGuard>
  );
}
