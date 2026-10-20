import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import Timeline from "@/features/where-is-my-load/timeline";
import TimelineHeader from "@/features/where-is-my-load/components/header";
import { getDictionary } from "@/features/i18n/i18n.service";
import { buildNavBarMessages } from "@/features/layout/utils/utils";
import { RouteGuard } from "@/features/auth/components/route-guard";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";

export default async function WheresMyLoadPage({
  params,
  searchParams,
}: ParamsWithLang & {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await guardPage(ACCESS_RULES.loadsSearch, "/where-is-my-load");
  const { lang } = await params;
  const resolvedSearchParams = await searchParams;
  const [dict, dictionary] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });

  return (
    <RouteGuard
      path="/where-is-my-load"
      fallbackPath={`/${lang}/shipping`}
    >
      <div className="h-full flex flex-col">
        <TimelineHeader
          dict={dictionary as I18nRecord}
          searchParams={resolvedSearchParams}
        />
        <div className="h-full w-full flex flex-row justify-center overflow-auto p-4 relative">
          <Timeline
            dict={dictionary as I18nRecord}
            messages={navBarMessages}
            lang={lang}
          />
        </div>
      </div>
    </RouteGuard>
  );
}
