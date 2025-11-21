import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { FaBook } from "react-icons/fa";
import MyTasks from "@/features/common/components/my-tasks/my-tasks";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { auth } from "@/auth";
import { SearchParams } from "next/dist/server/request/search-params";

export default async function MyTasksPage(params: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const paramsResult = await params.params;
  const { lang } = await paramsResult;
  const [, dict] = await getDictionary(lang);
  let status = getStatus((await params.searchParams)?.status);
  const session = await auth();
  const userGroups = await getGroupsForPerson(session!);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={[
            "tasks",
            status === "finished"
              ? ((dict["myTasks"] as I18nRecord)["completed_tasks"] as string)
              : ((dict["myTasks"] as I18nRecord)["pending_tasks"] as string),
          ]}
          lang={lang}
          rootIcon={<FaBook className="mr-2 h-4 w-4" />}
          dict={
            ((dict["layout"] as I18nRecord)["secured"] as I18nRecord)[
              "sidebar"
            ] as I18nRecord
          }
        />
      </div>
      <MyTasks
        dict={dict}
        status={status}
        userGroups={userGroups}
        lang={lang}
      />
    </div>
  );
}

function getStatus(status: string | string[] | undefined): string {
  if (typeof status === "string") {
    return status;
  }
  return status?.[0] ?? "pending";
}
