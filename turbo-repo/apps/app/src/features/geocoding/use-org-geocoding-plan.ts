"use client";

import useSWR from "swr";
import { ApiError, getJson } from "@/features/settings-admin/data/json-client";
import type { OrgGeocodingPlan } from "./geocoding-plan.types";

function planUrl(orgSlug: string, month: string): string {
  return `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/geocoding-plan?month=${month}`;
}

/** An organization's geocoding plan, quota and one month's usage. */
export function useOrgGeocodingPlan(orgSlug: string | null, month: string) {
  const { data, error, isLoading } = useSWR<OrgGeocodingPlan, ApiError>(
    orgSlug ? ["org-geocoding-plan", orgSlug, month] : null,
    ([, slug, m]: [string, string, string]) =>
      getJson<OrgGeocodingPlan>(planUrl(slug, m)),
    { revalidateOnFocus: false, keepPreviousData: true }
  );
  return { data: data ?? null, isLoading, error: error ?? null };
}
