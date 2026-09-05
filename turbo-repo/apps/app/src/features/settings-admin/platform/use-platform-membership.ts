"use client";

import useSWR from "swr";
import { fetchMyPlatformRoles } from "./platform-data-service";
import { PLATFORM_OWNER_ROLE } from "./platform.types";

/**
 * Whether the signed-in user holds `PLATFORM_OWNER`.
 *
 * Fails closed: false while the fetch is in flight and false if it fails, so
 * a surface gated on this never appears to someone the modulith would refuse.
 * The navigation calls this on every secured page, hence the long deduping
 * window and no retries — the answer changes about as often as a role grant.
 */
export function useIsPlatformOwner(): {
  isPlatformOwner: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useSWR("platform-roles-me", fetchMyPlatformRoles, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    dedupingInterval: 300_000,
  });

  return {
    isPlatformOwner: data?.roleCodes.includes(PLATFORM_OWNER_ROLE) ?? false,
    isLoading,
  };
}
