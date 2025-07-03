import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { HiClipboardList } from "react-icons/hi";
import ClientMapStarter from "@/features/geographic-view/components/client-map-starter";
//import { RouteGuard } from "@/features/auth/components/route-guard";

export default async function GeographicViewPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);

  /* 
const layers = [
  // Here we will add the layers of information that will be displayed in front of the map
];
*/

  return (
    /*  <RouteGuard path="/geographic-view" fallbackPath={`/${lang}/shipping`}> */
    <div className="h-full w-full flex flex-col">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["mission_control", "geographic_view"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      <div className="flex-1 relative">
        <ClientMapStarter dict={dict} />
      </div>
    </div>
    /*  </RouteGuard> */
  );
}
