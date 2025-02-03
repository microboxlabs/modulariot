import { HiClipboardList } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import SymptomsTable from "@/features/symptoms/table";
import SymptomsCards from "@/features/symptoms/cards";
export default async function SymptomsPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);
  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="px-4 pt-6 pb-2">
        <Breadcrumb
          path={["Control Tower", "symptoms"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict}
        />
      </div>
      <div className="flex-1 relative p-5">
        <div className="flex flex-col gap-4">
          <SymptomsCards />
          <SymptomsTable />
        </div>
      </div>
    </div>
  );
}
