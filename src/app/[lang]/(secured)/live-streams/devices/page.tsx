import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";

export default async function AllDevicesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [tr] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col justify-center items-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {tr("layout.secured.sidebar.allDevices")}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {tr("layout.secured.sidebar.liveStreams")}
        </p>
      </div>
    </div>
  );
}
