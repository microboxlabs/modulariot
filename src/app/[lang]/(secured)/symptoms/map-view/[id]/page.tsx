import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { HiClipboardList } from "react-icons/hi";
import GeneralMap from "@/features/symptoms/components/map-view/general-map";

interface MapViewParams {
  params: {
    lang: string;
    id: string;
  };
  searchParams: {
    tripId?: string;
    assetId?: string;
  };
}

export default async function SymptomList({
  params: { lang, id },
  searchParams,
}: MapViewParams) {
  const [, dict] = await getDictionary(lang);
  // Get tripId from query parameters if available
  const tripId = searchParams.tripId;

  const assetId = searchParams.assetId;
  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["mission_control", "symptoms", "map-view"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      <GeneralMap dict={dict} id={id} tripId={tripId} assetId={assetId} />
    </div>
  );
}
