import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { HiClipboardList } from "react-icons/hi";
import SymptomsIcuList from "@/features/symptoms/components/symptoms-list/symptoms-icu-list";

interface SymptomsListParams extends ParamsWithLang {
  condition: string;
  lang: string;
}

export default async function SymptomsList({
  params: { lang, condition },
}: {
  params: SymptomsListParams;
}) {
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["mission_control", "symptoms", "symptoms-list"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      <SymptomsIcuList condition={condition} dict={dict} lang={lang} />
    </div>
  );
}
