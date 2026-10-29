"use client";

import useSWR from "swr";
import { ApiError, getJson, sendJson } from "../data/json-client";
import type {
  GeocodingPlan,
  GeocodingSubscription,
  OrgGeocodingUsage,
  SetGeocodingPlan,
  SetGeocodingSubscription,
} from "@/features/geocoding/geocoding-plan.types";

const PLAN_URL = "/app/api/admin/platform/geocoding-plan";

/** The geocoding plan, with save. */
export function useGeocodingPlan() {
  const { data, error, isLoading, mutate } = useSWR<GeocodingPlan, ApiError>(
    "platform-geocoding-plan",
    () => getJson<GeocodingPlan>(PLAN_URL),
    { revalidateOnFocus: false }
  );

  const save = async (value: SetGeocodingPlan) => {
    const saved = await sendJson<GeocodingPlan>("PUT", PLAN_URL, value);
    await mutate(saved, { revalidate: false });
    return saved;
  };

  return { plan: data ?? null, isLoading, error: error ?? null, save };
}

/**
 * Every organization with a subscription or usage in `month` (YYYY-MM), and
 * how to set one organization's subscription.
 */
export function useGeocodingSubscriptions(month: string) {
  const { data, error, isLoading, mutate } = useSWR<
    OrgGeocodingUsage[],
    ApiError
  >(
    ["platform-geocoding-usage", month],
    ([, m]: [string, string]) =>
      getJson<OrgGeocodingUsage[]>(`${PLAN_URL}/usage?month=${m}`),
    { revalidateOnFocus: false }
  );

  const saveSubscription = async (
    organization: string,
    value: SetGeocodingSubscription
  ) => {
    const saved = await sendJson<GeocodingSubscription>(
      "PUT",
      `/app/api/admin/orgs/${encodeURIComponent(organization)}/geocoding-plan`,
      value
    );
    await mutate();
    return saved;
  };

  return {
    organizations: data ?? [],
    isLoading,
    error: error ?? null,
    saveSubscription,
  };
}
