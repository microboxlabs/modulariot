import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import JobConsolePageContent from "@/features/integration-jobs/components/job-console-page-content";

export default async function IntegrationJobsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.integrationJobs as I18nRecord;

  return (
    <RouteGuard path="/integrations/jobs" fallbackPath={`/${lang}/shipping`}>
      {/* LayoutContent is overflow-hidden — pages own their scroll (same
          wrapper as fleet-management). */}
      <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
        <JobConsolePageContent dict={dict ?? {}} />
      </div>
    </RouteGuard>
  );
}
