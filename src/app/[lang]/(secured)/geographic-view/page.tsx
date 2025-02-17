import MapVisualization from "@/features/geographic-view/components/map-visualization";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { HiClipboardList } from "react-icons/hi";

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
    <div className="h-full w-full flex flex-col">
      <div className="px-4 pt-6 pb-2">
        <Breadcrumb
          path={["Control Tower", "geographic-view"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict}
        />
      </div>
      <div className="flex-1 relative">
        <MapVisualization dict={dict} />
      </div>
    </div>
  );
}
