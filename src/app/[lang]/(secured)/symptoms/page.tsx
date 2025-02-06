import { HiClipboardList } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ClientSymptoms from "../../../../features/symptoms/client-symptoms";

export default async function SymptomsPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);
  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 pt-6 pb-2">
        <Breadcrumb
          path={["Control Tower", "symptoms"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict}
        />
      </div>
      {/* 
        The reason of why there is no padding here but in the individual elements inside, is because the
        animation of hiding the cards is not working if there is padding.
      */}
      <div className="flex-1 relative overflow-y-auto">
        <ClientSymptoms />
      </div>
    </div>
  );
}
