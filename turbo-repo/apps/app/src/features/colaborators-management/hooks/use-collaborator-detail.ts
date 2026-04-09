import useSWR from "swr";
import type { ColaboratorDetailDto } from "../types/colaborators.types";

type FetcherResult = {
  detail: ColaboratorDetailDto | null;
  disabled: boolean;
  notFound: boolean;
};

/**
 * 501 → `MIOT_COLLABORATORS_SOURCE` is unset. Caller should fall back to
 * the mock data service without showing an error banner.
 * 404 → cod_driver doesn't exist upstream. Caller shows a "not found"
 * empty state instead of an error.
 * Other non-2xx → throw so SWR's error state kicks in.
 */
const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 501) {
    return { detail: null, disabled: true, notFound: false };
  }
  if (response.status === 404) {
    return { detail: null, disabled: false, notFound: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const detail = (await response.json()) as ColaboratorDetailDto;
  return { detail, disabled: false, notFound: false };
};

/**
 * Fetch one driver's expediente from `/api/collaborators/[codDriver]`.
 *
 * Dedup window: 30s — matches the server-side cache TTL. Passing
 * `null`/`undefined` for the cod_driver disables the SWR request (used
 * while the page waits for the route param to resolve).
 *
 * Mirrors `useCollaborators` 1:1 for consistency — 501-aware fetcher,
 * same retry/dedup settings, same `{ disabled, error, isLoading, mutate }`
 * return shape plus a new `notFound` flag and the unwrapped
 * `colaborator` / `detailData` fields.
 */
export function useCollaboratorDetail(codDriver: string | null | undefined) {
  const trimmed = codDriver?.trim() ?? "";
  const url =
    trimmed.length > 0
      ? `/app/api/collaborators/${encodeURIComponent(trimmed)}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 30_000 }
  );

  return {
    colaborator: data?.detail?.colaborator ?? null,
    detailData: data?.detail?.detailData ?? null,
    disabled: data?.disabled ?? false,
    notFound: data?.notFound ?? false,
    error,
    isLoading,
    mutate,
  };
}
