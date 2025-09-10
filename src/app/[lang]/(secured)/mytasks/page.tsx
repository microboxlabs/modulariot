import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { FaBook } from "react-icons/fa";
import MyTasks from "@/features/common/components/my-tasks/my-tasks";

export default async function MyTasksPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["tasks", "tareas completadas"]}
          lang={lang}
          rootIcon={<FaBook className="mr-2 h-4 w-4" />}
          dict={
            ((dict["layout"] as I18nRecord)["secured"] as I18nRecord)[
              "sidebar"
            ] as I18nRecord
          }
        />
      </div>
      <MyTasks dict={dict} />
    </div>
  );
}
