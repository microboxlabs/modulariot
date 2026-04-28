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

const getErrorMessage = async (response: Response) => {
  try {
    const body = (await response.clone().json()) as {
      error?: string;
      message?: string;
    };
    return body.error ?? body.message;
  } catch {
    try {
      const text = await response.text();
      return text || undefined;
    } catch {
      return undefined;
    }
  }
};

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
    let response: Response;
    try {
      response = await fetch("/app/api/user/active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch (error) {
      console.error("Failed to switch active organization", error);
      throw new Error("No se pudo cambiar la organización. Revisa tu conexión.");
    }

    if (!response.ok) {
      const message = await getErrorMessage(response);
      const error = new Error(
        message ?? `No se pudo cambiar la organización (${response.status})`,
      );
      console.error("Failed to switch active organization", error);
      throw error;
    }

    await mutate();
    globalThis.location.reload();
  };

  return {
    activeOrg: data?.activeOrg ?? null,
    availableOrgs: data?.availableOrgs ?? [],
    isLoading,
    error,
    switchOrg,
  };
}
