"use client";

import { useDashboardConfigs } from "../../hooks/use-dashboard-dynamic-items";
import { DashboardCard } from "./dashboard-card";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface DashboardListProps {
  dict: I18nRecord;
}

export function DashboardList({ dict }: Readonly<DashboardListProps>) {
  const { dashboards, isLoading } = useDashboardConfigs();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {tr("dashboard.landing.no_dashboards", dict)}
      </p>
    );
  }

  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {dashboards.map((dashboard) => (
        <DashboardCard
          key={dashboard.slug}
          slug={dashboard.slug}
          name={dashboard.name}
        />
      ))}
    </div>
  );
}
