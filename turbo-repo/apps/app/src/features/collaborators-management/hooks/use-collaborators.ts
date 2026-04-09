import useSWR from "swr";
import type { Collaborator } from "../types/collaborators.types";

type FetcherResult = {
  collaborators: Collaborator[];
  disabled: boolean;
};

/**
 * 501 from the API route means `MIOT_COLLABORATORS_SOURCE` is unset — the
 * page should quietly fall back to the mock data service instead of
 * showing an error banner.
 */
const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 501) {
    return { collaborators: [], disabled: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const collaborators = (await response.json()) as Collaborator[];
  return { collaborators, disabled: false };
};

/**
 * Fetch the collaborators list from `/app/api/collaborators`, with an
 * optional `q` search string that is forwarded to the PostgREST view as
 * an OR match across `name_driver`, `cust_account`, and `cod_driver`.
 *
 * Dedup window: 30s — matches the server-side cache TTL. Passing
 * `null`/`undefined` for `query` disables the SWR request (used while the
 * page waits for the first render).
 */
export function useCollaborators(query?: string | null) {
  const trimmed = query?.trim() ?? "";
  const params = new URLSearchParams();
  if (trimmed.length > 0) params.set("q", trimmed);
  const qs = params.toString();
  const url = `/app/api/collaborators${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 30_000 }
  );

  return {
    collaborators: data?.collaborators ?? [],
    disabled: data?.disabled ?? false,
    error,
    isLoading,
    mutate,
  };
}
