import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { FaBook } from "react-icons/fa";
import MyTasks from "@/features/common/components/my-tasks/my-tasks";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { auth } from "@/auth";
import { SearchParams } from "next/dist/server/request/search-params";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { KANBAN_ACCESS_ROLES } from "@/features/auth/config/route-permissions";

export default async function MyTasksPage(params: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const paramsResult = await params.params;
  const { lang } = paramsResult;
  const [, dict] = await getDictionary(lang);
  let status = getStatus((await params.searchParams)?.status);
  const session = await auth();
  const userGroups = await getGroupsForPerson(session!);

  return (
    <RouteGuard
      requiredGroups={KANBAN_ACCESS_ROLES}
      fallbackPath={`/${lang}/geographic-view`}
    >
      <div className="h-full flex flex-col overflow-hidden">
        <SectionHeader
          path={[
            "tasks",
            status === "finished"
              ? ((dict["myTasks"] as I18nRecord)["completed_tasks"] as string)
              : ((dict["myTasks"] as I18nRecord)["pending_tasks"] as string),
          ]}
          lang={lang}
          rootIcon={<FaBook className="mr-2 h-4 w-4" />}
          breadcrumbDict={
            ((dict["layout"] as I18nRecord)["secured"] as I18nRecord)[
              "sidebar"
            ] as I18nRecord
          }
          filterDict={dict as I18nRecord}
        />
        <div className="max-w-screen-2xl mx-auto w-full flex-1 overflow-hidden">
          <MyTasks
            dict={dict}
            status={status}
            userGroups={userGroups}
            lang={lang}
          />
        </div>
      </div>
    </RouteGuard>
  );
}

function getStatus(status: string | string[] | undefined): string {
  if (typeof status === "string") {
    return status;
  }
  return status?.[0] ?? "pending";
}
