import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { TaskEditPageParams } from "./page.types";
import { auth } from "@/auth";
import { getTaskById } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { TaskForm } from "@/features/task-forms/components/task-form/task-form";
import { notFound } from "next/navigation";
import { redirectWithLang } from "@/features/auth/services/navigation.service";

export default async function TaskEditPage({
  params: { taskId, lang },
}: ParamsWithLang<TaskEditPageParams>) {
  const session = await auth();
  const [, _dictionary] = await getDictionary(lang);
  try {
    // eslint-disable-next-line no-console
    console.time(`getTaskById-${taskId}`);
    const task = await getTaskById(session!.user.ticket, taskId);
    // eslint-disable-next-line no-console
    console.timeEnd(`getTaskById-${taskId}`);
    return <TaskForm task={task} lang={lang} ticket={session!.user.ticket} />;
  } catch (e: any) {
    if (e?.status === 401) {
      redirectWithLang(`/sign-in`);
    }
    notFound();
  }
  return null;
}
