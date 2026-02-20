import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { HiCalendar } from "react-icons/hi";
import { CalendarLanding } from "@/features/calendar/components/calendar-landing/calendar-landing";

export default async function CalendarPage(props: ParamsWithLang) {
  const { lang } = await props.params;

  const session = await auth();
  if (!session) {
    redirect(`/${lang}/sign-in`);
  }

  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["calendar"]}
          lang={lang}
          rootIcon={<HiCalendar className="mr-2 h-4 w-4" />}
          dict={dict.layout.secured.sidebar}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <CalendarLanding lang={lang} />
      </div>
    </div>
  );
}
