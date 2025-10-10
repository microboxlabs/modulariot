import "server-only";
import { auth } from "@/auth";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import PageContent from "@/features/shipping/components/content";
import { getStaticPlanningData } from "@/features/shipping/services/data.service";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
export default async function PlanningPage({
  params: { lang },
}: Readonly<ParamsWithLang>) {
  try {
    const [, dictionary] = await getDictionary(lang);
    const session = await auth();
    if (!session) {
      redirectWithLang(`/sign-in`);
    }
    const userGroups = await getGroupsForPerson(session);
    const staticData = getStaticPlanningData();

    return (
      <PageContent
        showFinishedTasks={false}
        showWorkflowTasks="planning"
        kanbanBoards={staticData}
        lang={lang}
        dictionary={{
          base: (dictionary.pages as I18nRecord)?.planning as I18nRecord,
          general: dictionary,
        }}
        userGroups={userGroups}
      />
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
