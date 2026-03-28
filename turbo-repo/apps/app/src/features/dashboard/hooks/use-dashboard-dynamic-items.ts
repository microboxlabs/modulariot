"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useUserSite } from "@/features/common/providers/client-api.provider";
import type { SidebarItem } from "@/features/layout/types/common.types";

interface DashboardConfigSummary {
  slug: string;
  name: string;
}

interface DashboardConfigsResponse {
  data: DashboardConfigSummary[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dashboard fetch failed (${res.status}): ${body}`);
  }
  return res.json();
};

export function useDashboardConfigs() {
  const { siteName } = useUserSite();

  const { data, error, isLoading, mutate } = useSWR<DashboardConfigsResponse>(
    siteName ? `/app/api/dashboard/configs?site=${encodeURIComponent(siteName)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    dashboards: data?.data ?? [],
    error,
    isLoading,
    mutate,
    siteName,
  };
}

export function useDashboardDynamicItems(): SidebarItem[] {
  const { dashboards } = useDashboardConfigs();

  return useMemo(() => {
    if (dashboards.length === 0) return [];

    return dashboards.map((dashboard) => ({
      href: `/home/${dashboard.slug}`,
      label: dashboard.name,
      requiredGroups: ["GROUP_DASHBOARD"],
    }));
  }, [dashboards]);
}
