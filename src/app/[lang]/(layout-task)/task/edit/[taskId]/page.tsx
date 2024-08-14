import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { TaskEditPageParams } from "./page.types";
import { auth } from "@/auth";
import { getTaskById } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { TaskForm } from "@/features/task-forms/components/task-form/task-form";

export default async function TaskEditPage({
  params: { taskId, lang },
}: ParamsWithLang<TaskEditPageParams>) {
  const session = await auth();
  const [, _dictionary] = await getDictionary(lang);
  const task = await getTaskById(session!.user.ticket, taskId);
  return <TaskForm task={task.data} />;
}
