import "server-only";
import { auth } from "@/auth";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import PageContent from "@/features/shipping/components/content";
import { getStaticPlanningData } from "@/features/shipping/services/data.service";
import { redirectWithLang } from "@/features/auth/services/navigation.service";
import { guardPage } from "@/features/auth/access/server-access";
import { requireBoard } from "@/features/layout/services/board-guard";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
export default async function PlanningPage({ params }: ParamsWithLang) {
  requireBoard("kanban");
  await guardPage(ACCESS_RULES.kanban, "/planning");
  const { lang } = await params;
  try {
    const [, dictionary] = await getDictionary(lang);
    const session = await auth();
    if (!session) {
      await redirectWithLang(`/sign-in`);
    }
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
