import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { HiHome } from "react-icons/hi";
import Notifications from "@/features/common/components/notification/notifications";

/*
{
  name: "Rodrigo Seguel",
  timeStamp: "2025-06-17T10:00:00.000Z",
  read: false,
  type: "",
  data: {
    
  }
},
*/

export default async function SymptomsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      {/* BREADCRUMB */}
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["home", "notifications"]}
          lang={lang}
          rootIcon={<HiHome className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      {/* BREADCRUMB */}
      {/* CONTENT */}
      <Notifications lang={lang} />
      {/* CONTENT */}
    </div>
  );
}
