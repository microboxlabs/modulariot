"use client";

import useSWR from "swr";

interface OrgScopeItem {
  id: number;
  slug: string;
  displayName: string;
  taxId: string | null;
  isParent: boolean;
}

interface ActiveOrgItem extends OrgScopeItem {
  role: string;
  modules: string[];
}

interface OrgScopesResponse {
  activeOrg: ActiveOrgItem;
  availableOrgs: OrgScopeItem[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json() as Promise<OrgScopesResponse>;
};

export function useOrgScopes() {
  const { data, error, isLoading, mutate } = useSWR<OrgScopesResponse>(
    "/app/api/user/scopes",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    },
  );

  const switchOrg = async (slug: string) => {
    await fetch("/app/api/user/active-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    await mutate();
    window.location.reload();
  };

  return {
    activeOrg: data?.activeOrg ?? null,
    availableOrgs: data?.availableOrgs ?? [],
    isLoading,
    error,
    switchOrg,
  };
}
