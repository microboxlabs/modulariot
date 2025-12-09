import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { buildNavBarMessages } from "@/features/layout/utils/utils";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { auth } from "@/auth";
import SignalHistoryForm from "@/features/signal-history/signal-history-form";

export default async function WheresMyLoadPage({
  params,
}: ParamsWithLang & {}) {
  const { lang } = await params;
  const [dict, dictionary] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });
  const session = await auth();
  const userGroups = await getGroupsForPerson(session!);

  return (
    <div className="h-full w-full flex flex-row justify-center overflow-auto relative">
      <SignalHistoryForm dict={dictionary} messages={navBarMessages} />
    </div>
  );
}
