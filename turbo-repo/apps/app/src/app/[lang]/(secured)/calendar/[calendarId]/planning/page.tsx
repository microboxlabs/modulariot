import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Planning from "@/features/calendar/components/planning/planning";

export default async function CalendarIdPlanningPage(
  props: ParamsWithLang<{ calendarId: string }>
) {
  const { lang, calendarId } = await props.params;
  const session = await auth();
  if (!session) redirect(`/${lang}/sign-in`);
  const [, dictionary] = await getDictionary(lang);

  return (
    <div className="h-full overflow-hidden">
      <Planning lang={lang} dict={dictionary} calendarId={calendarId} />
    </div>
  );
}
