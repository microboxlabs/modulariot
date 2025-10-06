import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import Timeline from "@/features/where-is-my-load/timeline";
import TimelineHeader from "@/features/where-is-my-load/components/header";
import { getDictionary } from "@/features/i18n/i18n.service";

export default async function WheresMyLoadPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dictionary] = await getDictionary(lang);

  return (
    <div className="h-full flex flex-col">
      <TimelineHeader />
      <div className="h-full w-full flex justify-center overflow-auto p-4">
        <Timeline dict={dictionary as I18nRecord} />
      </div>
    </div>
  );
}
