"use client";

import useSWR from "swr";
import type { ApiError } from "../data/json-client";
import {
  fetchOrganizationOwners,
  fetchPlatformOrganizations,
} from "./platform-data-service";
import type {
  PlatformOrganizationListItem,
  PlatformOrganizationRole,
} from "./platform.types";

/** SWR key of the platform-wide organization list; revalidated after a create. */
export const PLATFORM_ORGANIZATIONS_KEY = "platform-organizations";

/** Every active organization. Fetches only when `enabled` (a platform owner). */
export function usePlatformOrganizations(enabled: boolean) {
  const { data, error, isLoading } = useSWR<
    PlatformOrganizationListItem[],
    ApiError
  >(enabled ? PLATFORM_ORGANIZATIONS_KEY : null, fetchPlatformOrganizations, {
    revalidateOnFocus: false,
  });
  return { organizations: data ?? [], error, isLoading };
}

/** The owners of one organization, read through the platform API. */
export function useOrganizationOwners(slug: string | null) {
  const { data, error, isLoading } = useSWR<PlatformOrganizationRole, ApiError>(
    slug ? ["platform-organization-owners", slug] : null,
    () => fetchOrganizationOwners(slug ?? ""),
    { revalidateOnFocus: false }
  );
  return { owners: data?.assigneeIds ?? [], error, isLoading };
}
