"use client";

import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import fetcher from "@/features/common/providers/fetcher";
import type { FetcherError } from "@/features/common/providers/fetcher.types";

/**
 * Mirror of `PgrestAccreditedResourceRow` in `app/api/utils/pgrest-client.ts`.
 * Re-declared here (not imported) so the client bundle does not pull the
 * `server-only` pgrest module.
 */
export interface AccreditedResource {
  resource_type: "DRIVER" | "TRUCK" | "TRAILER" | "CARRIER";
  resource_id: string;
  resource_name: string | null;
  identifier: string | null;
  faena: string | null;
  rut_mandante: string | null;
  is_acredited: "ACREDITED" | "NOT ACREDITED";
  trip_count: number | null;
  last_trip: string | null;
  symptoms: Record<string, number> | null;
  updated_at: string | null;
}

export type AccreditedResourceType = AccreditedResource["resource_type"];

interface AccreditedResourcesPage {
  data: AccreditedResource[];
  total: number;
  filteredTotal: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

interface UseAccreditedResourcesOpts {
  rutMandante?: string | null;
  delegacion?: string | null;
  resourceType?: AccreditedResourceType;
  /**
   * When set, forwards `carrierId=` to the endpoint (→ upstream `p_carrier_id`)
   * so child resources (DRIVER/TRUCK/TRAILER) are scoped to a transportist.
   * Empty string or null keeps the hook idle for DRIVER queries gated on a
   * prior carrier selection.
   */
  carrierId?: string | null;
  /** Case-insensitive substring, matched against resource_name and identifier. */
  query?: string;
  pageSize?: number;
  /**
   * When false, the hook stays idle regardless of the other args. Use this to
   * gate child queries (e.g. "only fetch drivers once a carrier is selected").
   */
  enabled?: boolean;
}

/**
 * Paginated accredited-resources feed, backed by
 * `/app/api/calendar/accredited-resources` (which in turn caches the upstream
 * pgrest function for 5 min). Stays idle until both `rutMandante` and
 * `delegacion` are set — matches the calendar UX where the combobox only
 * activates once a service is selected.
 *
 * Each change to `query` resets the feed to page 0 (SWR key is query-scoped).
 * `loadMore` fetches the next page; `hasMore` tracks whether the server still
 * has filtered rows past what we've accumulated.
 */
export function useAccreditedResources(opts: UseAccreditedResourcesOpts) {
  const {
    rutMandante,
    delegacion,
    resourceType,
    carrierId,
    query = "",
    pageSize = DEFAULT_PAGE_SIZE,
    enabled = true,
  } = opts;

  const canFetch = Boolean(enabled && rutMandante && delegacion);

  const getKey = useCallback(
    (pageIndex: number, previousPage: AccreditedResourcesPage | null) => {
      if (!canFetch) return null;
      if (previousPage && !previousPage.hasMore) return null;
      const params = new URLSearchParams();
      if (rutMandante) params.set("rutMandante", rutMandante);
      if (delegacion) params.set("delegacion", delegacion);
      if (resourceType) params.set("resourceType", resourceType);
      if (carrierId) params.set("carrierId", carrierId);
      if (query) params.set("q", query);
      params.set("offset", String(pageIndex * pageSize));
      params.set("limit", String(pageSize));
      return `/app/api/calendar/accredited-resources?${params.toString()}`;
    },
    [canFetch, rutMandante, delegacion, resourceType, carrierId, query, pageSize]
  );

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<AccreditedResourcesPage, FetcherError>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    });

  const resources = useMemo<AccreditedResource[]>(
    () => (data ?? []).flatMap((page) => page.data),
    [data]
  );

  const lastPage = data && data.length > 0 ? data[data.length - 1] : null;
  const hasMore = lastPage ? lastPage.hasMore : false;
  const filteredTotal = lastPage ? lastPage.filteredTotal : 0;
  const total = lastPage ? lastPage.total : 0;

  // `isValidating` + extra pages beyond `size` means we're loading the next page
  const isLoadingMore =
    canFetch &&
    (isLoading ||
      (size > 0 && data !== undefined && typeof data[size - 1] === "undefined"));

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setSize((s) => s + 1);
  }, [hasMore, isLoadingMore, setSize]);

  return {
    resources,
    total,
    filteredTotal,
    hasMore,
    loadMore,
    isLoading: canFetch && isLoading && !data,
    isLoadingMore,
    isValidating,
    error,
    refresh: mutate,
  };
}
