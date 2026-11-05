"use client";

import useSWR from "swr";
import { ApiError, getJson } from "@/features/settings-admin/data/json-client";
import { currentMonth, type OrgTelephonyPlan } from "./telephony-plan";

/** An organization's managed telephony this month; nothing is fetched without `orgSlug`. */
export function useOrgTelephonyUsage(orgSlug: string | null) {
  const month = currentMonth();
  const { data, error } = useSWR<OrgTelephonyPlan, ApiError>(
    orgSlug ? ["org-telephony-usage", orgSlug, month] : null,
    ([, slug, m]: [string, string, string]) =>
      getJson<OrgTelephonyPlan>(
        `/app/api/admin/orgs/${encodeURIComponent(slug)}/telephony-usage?month=${m}`
      ),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return { data: data ?? null, error: error ?? null };
}
