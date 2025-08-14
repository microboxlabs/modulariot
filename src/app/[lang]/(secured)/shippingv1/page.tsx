import "server-only";
// import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { auth } from "@/auth";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import PageContent from "@/features/shipping/components/content";
import {
  getStaticData,
  // toShippingKanban,
} from "@/features/shipping/services/data.service";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export default async function ShippingPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dictionary] = await getDictionary(lang);
  const session = await auth();
  const userGroups = await getGroupsForPerson(session!);
  // let tasks;
  try {
    // tasks = await getUserTasks(session!);
    // const data = await toShippingKanban(tasks);
    // const data = [];
    const staticData = await getStaticData();
    // const boards = staticData.map((board) => {
    //   return {
    //     ...board,
    //     tasks: data[board.title]?.tasks || board.tasks,
    //   };
    // });
    return (
      <>
        <PageContent
          showFinishedTasks={false}
          kanbanBoards={staticData}
          lang={lang}
          dictionary={{
            base: (dictionary.pages as I18nRecord)?.shippingv1 as I18nRecord,
            general: dictionary,
          }}
          userGroups={userGroups}
        />
      </>
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.status === 401) {
      redirectWithLang(`/sign-in`);
    }
  }
  return null;
}
