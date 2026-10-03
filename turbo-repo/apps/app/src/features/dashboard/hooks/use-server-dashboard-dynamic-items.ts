"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { SidebarItem } from "@/features/layout/types/common.types";
import { createDashboardServerClient } from "../services/dashboard-server-client";

/** Sidebar entries for the active organization's dashboard-server dashboards, in server (name) order. */
export function useServerDashboardDynamicItems(
  enabled: boolean
): SidebarItem[] {
  const { activeOrg } = useOrgScopes();
  const org = enabled ? activeOrg?.slug : undefined;
  const client = useMemo(
    () => (org ? createDashboardServerClient(org) : null),
    [org]
  );
  const { data } = useSWR(
    client ? ["sidebar", client.key()] : null,
    () => client!.list(),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return useMemo(
    () =>
      (data ?? []).map((dashboard) => ({
        href: `/dashboards/${encodeURIComponent(dashboard.slug)}`,
        label: dashboard.name,
      })),
    [data]
  );
}
