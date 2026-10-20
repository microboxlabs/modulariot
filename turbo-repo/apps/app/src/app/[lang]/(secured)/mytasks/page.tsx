import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { FaBook } from "react-icons/fa";
import MyTasks from "@/features/common/components/my-tasks/my-tasks";
import { SearchParams } from "next/dist/server/request/search-params";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";

export default async function MyTasksPage(params: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await guardPage(ACCESS_RULES.kanban, "/mytasks");
  const paramsResult = await params.params;
  const { lang } = paramsResult;
  const [, dict] = await getDictionary(lang);
  let status = getStatus((await params.searchParams)?.status);

  return (
    <RouteGuard
      path="/mytasks"
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
