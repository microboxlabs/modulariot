import { auth } from "@/auth";
import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import KanbanPageContent from "@/features/shipping/components/content";
import {
  getStaticData,
  toShippingKanban,
} from "@/features/shipping/services/data.service";

export default async function ShippingPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dictionary] = await getDictionary(lang);
  const session = await auth();
  const tasks = await getUserTasks(session!.user.ticket);
  const data = await toShippingKanban(tasks);
  const staticData = await getStaticData();
  const boards = staticData.map((board) => {
    return {
      ...board,
      tasks: data[board.title]?.tasks || board.tasks,
    };
  });
  return (
    <KanbanPageContent
      kanbanBoards={boards}
      tasks={tasks}
      dict={(dictionary.pages as I18nRecord)?.shipping as I18nRecord}
    />
  );
}
