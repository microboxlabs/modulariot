import { HiClipboardList } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ClientSymptoms from "../../../../features/symptoms/client-symptoms";
import { RouteGuard } from "@/features/auth/components/route-guard";

export default async function SymptomsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);
  return (
    <RouteGuard path="/symptoms" fallbackPath={`/${lang}/shipping`}>
      <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
        <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
          <Breadcrumb
            path={["mission_control", "symptoms"]}
            lang={lang}
            rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
            dict={dict["symptoms"] as I18nRecord}
          />
        </div>
        {/* 
          The reason of why there is no padding here but in the individual elements inside, is because the
          animation of hiding the cards is not working if there is padding.
        */}
        <ClientSymptoms dict={dict} />
      </div>
    </RouteGuard>
  );
}
