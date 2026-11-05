"use client";

import useSWR from "swr";
import { ApiError, getJson, sendJson } from "../data/json-client";
import type {
  OrgTelephonyUsage,
  TelephonyPlan,
  TelephonySubscription,
} from "@/features/telephony/telephony-plan";

const PLAN_URL = "/app/api/admin/platform/telephony-plan";

/** The managed telephony plan, with save. */
export function useTelephonyPlan() {
  const { data, error, isLoading, mutate } = useSWR<TelephonyPlan, ApiError>(
    "platform-telephony-plan",
    () => getJson<TelephonyPlan>(PLAN_URL),
    { revalidateOnFocus: false }
  );
  const save = async (
    value: Omit<TelephonyPlan, "updatedBy" | "updatedAt">
  ) => {
    const saved = await sendJson<TelephonyPlan>("PUT", PLAN_URL, value);
    await mutate(saved, { revalidate: false });
    return saved;
  };
  return { plan: data ?? null, isLoading, error: error ?? null, save };
}

/** Every organization's managed telephony in `month` (YYYY-MM), and how to set its minutes. */
export function useTelephonyTenants(month: string) {
  const { data, error, isLoading, mutate } = useSWR<
    OrgTelephonyUsage[],
    ApiError
  >(
    ["platform-telephony-usage", month],
    async ([, m]: [string, string]) =>
      (
        await getJson<{ organizations?: OrgTelephonyUsage[] }>(
          `${PLAN_URL}/usage?month=${m}`
        )
      ).organizations ?? [],
    { revalidateOnFocus: false }
  );
  const saveMinutes = async (
    tenantCode: string,
    monthlyMinutes: number | null
  ) => {
    const saved = await sendJson<TelephonySubscription>(
      "PUT",
      `${PLAN_URL}/organizations/${encodeURIComponent(tenantCode)}`,
      { monthlyMinutes }
    );
    await mutate();
    return saved;
  };
  return {
    organizations: data ?? [],
    isLoading,
    error: error ?? null,
    saveMinutes,
  };
}
