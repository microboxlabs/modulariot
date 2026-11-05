import { HiChartPie, HiFilter, HiDownload } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { DashboardFeatureCard } from "./dashboard-feature-card";

/** The dashboards landing header: icon, title, subtitle and the three feature cards. */
export function DashboardLandingHero({ dict }: Readonly<{ dict: I18nRecord }>) {
  const t = (key: string) => tr(`dashboard.landing.${key}`, dict);
  return (
    <>
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
        <HiChartPie className="h-12 w-12 text-blue-500" />
      </div>

      <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
        {t("title")}
      </h1>

      <p className="mb-12 max-w-lg text-center text-gray-500 dark:text-gray-400">
        {t("subtitle")}
      </p>

      <div className="mb-12 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        <DashboardFeatureCard
          icon={<HiChartPie className="h-6 w-6 text-blue-500" />}
          title={t("widgets_title")}
          description={t("widgets_description")}
        />
        <DashboardFeatureCard
          icon={<HiFilter className="h-6 w-6 text-blue-500" />}
          title={t("filters_title")}
          description={t("filters_description")}
        />
        <DashboardFeatureCard
          icon={<HiDownload className="h-6 w-6 text-blue-500" />}
          title={t("import_export_title")}
          description={t("import_export_description")}
        />
      </div>
    </>
  );
}
