"use client";

import useSWR from "swr";
import type { ApiError } from "../data/json-client";
import type { OrganizationRole } from "../types";
import {
  fetchAuth0Clients,
  fetchOrganizationOwners,
  fetchPlatformOrganizations,
} from "./platform-data-service";
import type {
  Auth0Client,
  PlatformOrganizationListItem,
} from "./platform.types";

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

/** SWR key of the Auth0 M2M applications; revalidated after a create. */
export const AUTH0_CLIENTS_KEY = "platform-auth0-clients";

/**
 * The Auth0 M2M applications no organization uses yet. Empty when Auth0
 * management is not set up on the platform.
 */
export function useUnlinkedAuth0Clients() {
  const { data } = useSWR<Auth0Client[], ApiError>(
    AUTH0_CLIENTS_KEY,
    fetchAuth0Clients,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return (data ?? []).filter((client) => client.organization === null);
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
