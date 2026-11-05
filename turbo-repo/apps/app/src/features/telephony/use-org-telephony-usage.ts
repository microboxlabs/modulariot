"use client";

import useSWR from "swr";
import { ApiError, getJson } from "@/features/settings-admin/data/json-client";
import { currentMonth, type OrgTelephonyPlan } from "./telephony-plan";

/**
 * An organization's managed telephony in `month` (YYYY-MM, the current one by
 * default); nothing is fetched without `orgSlug`.
 */
export function useOrgTelephonyUsage(
  orgSlug: string | null,
  month: string = currentMonth()
) {
  const { data, error, isLoading } = useSWR<OrgTelephonyPlan, ApiError>(
    orgSlug ? ["org-telephony-usage", orgSlug, month] : null,
    ([, slug, m]: [string, string, string]) =>
      getJson<OrgTelephonyPlan>(
        `/app/api/admin/orgs/${encodeURIComponent(slug)}/telephony-usage?month=${m}`
      ),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );
  return { data: data ?? null, isLoading, error: error ?? null };
}
