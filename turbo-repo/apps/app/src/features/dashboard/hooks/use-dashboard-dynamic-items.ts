"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useUserSite } from "@/features/common/providers/client-api.provider";
import type { SidebarItem } from "@/features/layout/types/common.types";

interface DashboardConfigSummary {
  slug: string;
  name: string;
  order?: number;
  path?: string;
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

function formatPathLabel(segment: string): string {
  return segment
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function groupDashboardsByPath(
  dashboards: DashboardConfigSummary[]
): SidebarItem[] {
  const sorted = dashboards
    .slice()
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const topLevel: SidebarItem[] = [];
  const groups = new Map<string, SidebarItem[]>();

  for (const dashboard of sorted) {
    const item: SidebarItem = {
      href: `/home/${dashboard.slug}`,
      label: dashboard.name,
      requiredGroups: ["GROUP_DASHBOARD"],
    };

    if (!dashboard.path) {
      topLevel.push(item);
      continue;
    }

    const segment = dashboard.path.replace(/^\/+|\/+$/g, "").split("/")[0];
    if (!segment) {
      topLevel.push(item);
      continue;
    }

    if (!groups.has(segment)) {
      groups.set(segment, []);
    }
    groups.get(segment)!.push(item);
  }

  const folderItems: SidebarItem[] = [];
  for (const [segment, children] of groups) {
    folderItems.push({
      label: formatPathLabel(segment),
      items: children,
      requiredGroups: ["GROUP_DASHBOARD"],
    });
  }

  return [...topLevel, ...folderItems];
}

export function useDashboardDynamicItems(): SidebarItem[] {
  const { dashboards } = useDashboardConfigs();

  return useMemo(() => {
    if (dashboards.length === 0) return [];
    return groupDashboardsByPath(dashboards);
  }, [dashboards]);
}
