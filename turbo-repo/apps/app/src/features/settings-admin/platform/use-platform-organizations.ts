"use client";

import useSWR from "swr";
import type { ApiError } from "../data/json-client";
import type { OrganizationRole } from "../types";
import {
  fetchOrganizationOwners,
  fetchPlatformOrganizations,
} from "./platform-data-service";
import type { PlatformOrganizationListItem } from "./platform.types";

/** SWR key of the platform-wide organization list; revalidated after a create. */
export const PLATFORM_ORGANIZATIONS_KEY = "platform-organizations";

/** SWR key of one organization's owners as the platform API reports them. */
export function organizationOwnersKey(slug: string) {
  return ["platform-organization-owners", slug] as const;
}

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
  const { data, error, isLoading } = useSWR<OrganizationRole, ApiError>(
    slug ? organizationOwnersKey(slug) : null,
    () => fetchOrganizationOwners(slug ?? ""),
    { revalidateOnFocus: false }
  );
  return { owners: data?.assigneeIds ?? [], error, isLoading };
}
