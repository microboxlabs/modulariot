import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { TaskEditPageParams } from "./page.types";
import { auth } from "@/auth";
import {
  getFinishedWorkflowByInstanceId,
  getGroupsForPerson,
  getTaskById,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { redirect } from "next/navigation";
import { ExtendedTaskResponse } from "@/features/task-forms/components/task-form/task-form.types";
import { ErrorTripView } from "@/features/shipping/components/error-trip/error-trip-view";
import { TaskBentoForm } from "@/features/task-forms/components/task-bento-form/task-bento";

export default async function TaskEditPage({
  params: { taskId, lang },
}: ParamsWithLang<TaskEditPageParams>) {
  try {
    const session = await auth();
    if (!session) {
      redirect(`/${lang}/sign-in`);
    }

    const [, _dictionary] = await getDictionary(lang);
    const taskResult = await getTaskById(session.user.ticket, taskId);

    const userGroups = await getGroupsForPerson(session.user.ticket);

    let task = taskResult;
    if ((typeof task == "string" && task == "null") || task == null) {
      const taskResponse = await getFinishedWorkflowByInstanceId(
        session.user.ticket,
        taskId,
      );

      if (taskResponse) {
        return (
          <div className="overflow-y-auto h-full">
            <TaskBentoForm
              task={taskResponse as ExtendedTaskResponse}
              lang={lang}
              msg={_dictionary}
              ticket={session.user.ticket}
              user={session.user.name ?? ""}
              userGroups={userGroups}
              active={false}
            />
          </div>
        );
      }
      return <ErrorTripView lang={lang} />;
    }

    return (
      <div className="h-full overflow-y-auto">
        <TaskBentoForm
          task={task as ExtendedTaskResponse}
          lang={lang}
          msg={_dictionary}
          ticket={session.user.ticket}
          user={session.user.name ?? ""}
          userGroups={userGroups}
          active={false}
        />
      </div>
    );
  } catch (e: any) {
    console.error(e);
    if (e?.status !== 401) {
      return <ErrorTripView lang={lang} />;
    }
  }
}
