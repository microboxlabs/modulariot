import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { auth } from "@/auth";
import { getDictionary } from "@/features/i18n/i18n.service";
import { redirect } from "next/navigation";
import Planning from "@/features/calendar/components/planning/planning";

export default async function CalendarPlanningPage(
  props: ParamsWithLang<object>
) {
  const { lang } = await props.params;

  const session = await auth();
  if (!session) {
    redirect(`/${lang}/sign-in`);
  }

  const [, dictionary] = await getDictionary(lang);

  return (
    <div className="h-full overflow-hidden">
      <Planning lang={lang} dict={dictionary} />
    </div>
  );
}
