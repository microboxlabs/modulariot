import { Card } from "flowbite-react";
import { HiClipboardList } from "react-icons/hi";
import DriverUserIcon from "@/features/icons/driver-user";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { defaultLocale } from "@/features/i18n/tr.service";
import { getDictionary } from "@/features/i18n/i18n.service";

export async function ErrorTripView({ lang }: { lang: string }) {
  const [dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  return (
    <div className="px-4 pt-6">
      <Breadcrumb
        path={["tasks", "shipping", "details"]}
        lang={lang}
        rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
        dict={dictionary}
      />
      <div className="flex-1 flex flex-col items-center gap-6">
        <Card className="gap-6 w-fit items-center justify-center">
          <div className="flex items-center justify-center">
            <DriverUserIcon />
          </div>
          <div className="h-px bg-gray-300 w-full"></div>
          <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">
            {dict("pages.errorTripView.title")}
          </h1>
          <p className="text-sm text-center text-gray-900 dark:text-white">
            {dict("pages.errorTripView.subtitle")}
          </p>
        </Card>
      </div>
    </div>
  );
}
