import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { TaskEditPageParams } from "./page.types";
import { auth } from "@/auth";
import {
  getFinishedWorkflows,
  getTaskById,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { TaskForm } from "@/features/task-forms/components/task-form/task-form";
import { notFound } from "next/navigation";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
import { ExtendedTaskResponse } from "@/features/task-forms/components/task-form/task-form.types";
import { ErrorTripView } from "@/features/shipping/components/error-trip/error-trip-view";

export default async function TaskEditPage({
  params: { taskId, lang },
}: ParamsWithLang<TaskEditPageParams>) {
  const session = await auth();
  const [, _dictionary] = await getDictionary(lang);
  try {
    // Get both results upfront
    const taskResult = await getTaskById(session!.user.ticket, taskId);
    let task = taskResult;
    console.log("task", task);
    if ((typeof task == "string" && task == "null") || task == null) {
      const finishedWorkflows = await getFinishedWorkflows(
        session!.user.ticket,
        {
          from: 0,
          size: 100,
          definitionKey: "shippingCoordinatorProcess",
        },
      ).then((res) => ({
        tasks: res.workflows,
        total: res.total,
      }));
      const taskResponse = finishedWorkflows.tasks.find((t) => t.id === taskId);
      console.log("taskResponse", taskResponse);
      if (taskResponse) {
        return (
          <TaskForm
            task={taskResponse as ExtendedTaskResponse}
            lang={lang}
            msg={_dictionary}
            ticket={session!.user.ticket}
            user={session!.user.name ?? ""}
          />
        );
      }
      return <ErrorTripView task={taskResponse} msg={_dictionary} />;
      //return redirectWithLang(`/shipping`);
    }
    return (
      <TaskForm
        task={task as ExtendedTaskResponse}
        lang={lang}
        msg={_dictionary}
        ticket={session!.user.ticket}
        user={session!.user.name ?? ""}
      />
    );
  } catch (e: any) {
    if (e?.status === 401) {
      redirectWithLang(`/sign-in`);
    }
    notFound();
  }
}
