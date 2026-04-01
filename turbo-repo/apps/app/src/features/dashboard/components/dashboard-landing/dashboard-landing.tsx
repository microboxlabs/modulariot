import { HiChartPie, HiFilter, HiDownload } from "react-icons/hi";
import { getDictionary } from "@/features/i18n/i18n.service";
import { tr } from "@/features/i18n/tr.service";
import { DashboardFeatureCard } from "./dashboard-feature-card";
import { DashboardLandingClient } from "./dashboard-landing-client";

interface DashboardLandingProps {
  lang: string;
}

export async function DashboardLanding({
  lang,
}: Readonly<DashboardLandingProps>) {
  const [, dict] = await getDictionary(lang);
  const { dashboard } = dict;
  const { landing } = dashboard;

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
        <HiChartPie className="h-12 w-12 text-blue-500" />
      </div>

      <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
        {tr("title", landing)}
      </h1>

      <p className="mb-12 max-w-lg text-center text-gray-500 dark:text-gray-400">
        {tr("subtitle", landing)}
      </p>

      <div className="mb-12 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        <DashboardFeatureCard
          icon={<HiChartPie className="h-6 w-6 text-blue-500" />}
          title={tr("widgets_title", landing)}
          description={tr("widgets_description", landing)}
        />
        <DashboardFeatureCard
          icon={<HiFilter className="h-6 w-6 text-blue-500" />}
          title={tr("filters_title", landing)}
          description={tr("filters_description", landing)}
        />
        <DashboardFeatureCard
          icon={<HiDownload className="h-6 w-6 text-blue-500" />}
          title={tr("import_export_title", landing)}
          description={tr("import_export_description", landing)}
        />
      </div>

      <DashboardLandingClient dict={dict} ctaLabel={tr("cta", landing)} />
    </div>
  );
}
