import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { DashboardLanding } from "@/features/dashboard/components/dashboard-landing/dashboard-landing";

export default async function HomePage(props: ParamsWithLang) {
  const { lang } = await props.params;

  const session = await auth();
  if (!session) {
    redirect(`/${lang}/sign-in`);
  }

  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full overflow-y-auto flex flex-col">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full z-10">
        <Breadcrumb
          path={["home"]}
          lang={lang}
          dict={dict.layout.secured.sidebar}
        />
      </div>
      <div className="flex-1 max-w-screen-2xl mx-auto w-full">
        <DashboardLanding lang={lang} />
      </div>
    </div>
  );
}
