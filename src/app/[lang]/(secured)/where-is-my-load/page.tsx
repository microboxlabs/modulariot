import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import Timeline from "@/features/where-is-my-load/timeline";
import TimelineHeader from "@/features/where-is-my-load/components/header";
import { getDictionary } from "@/features/i18n/i18n.service";
import { buildNavBarMessages } from "@/features/layout/utils/utils";

export default async function WheresMyLoadPage({
  params: { lang },
}: ParamsWithLang) {
  const [dict, dictionary] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });

  return (
    <div className="h-full flex flex-col">
      <TimelineHeader dict={dictionary as I18nRecord} />
      <div className="h-full w-full flex flex-row justify-center overflow-auto p-4 relative">
        <Timeline dict={dictionary as I18nRecord} messages={navBarMessages} />
      </div>
    </div>
  );
}
