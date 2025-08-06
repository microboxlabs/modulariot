import "server-only";
import { auth } from "@/auth";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
// import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import PageContent from "@/features/shipping/components/content";
import {
  getStaticShippingV2Data,
  // toShippingKanban,
} from "@/features/shipping/services/data.service";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
export default async function ShippingPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dictionary] = await getDictionary(lang);
  const session = await auth();
  const userGroups = await getGroupsForPerson(session!.user.ticket);
  // let tasks;
  try {
    // tasks = await getUserTasks(session!.user.ticket);
    // const data = await toShippingKanban(tasks);
    // const data = [];
    const staticData = await getStaticShippingV2Data();
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
          showWorkflowTasks="shipping"
          kanbanBoards={staticData}
          lang={lang}
          dictionary={{
            base: (dictionary.pages as I18nRecord)?.shipping as I18nRecord,
            general: dictionary,
          }}
          userGroups={userGroups}
        />
      </>
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(e);
    if (e?.status === 401) {
      redirectWithLang(`/sign-in`);
    }
  }
  return null;
}
