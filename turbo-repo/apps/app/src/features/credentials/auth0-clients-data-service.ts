"use client";

import { ApiError } from "@/features/settings-admin/data/settings-admin-data-service";

/**
 * Reads the Auth0 M2M client directory through the org admin proxy. Mirrors
 * `credentials-data-service` in shape so both halves of the credential screen
 * fail the same way.
 */

/** One selectable M2M application. Never carries a secret. */
export interface M2MClientOption {
  readonly clientId: string;
  readonly name: string;
  readonly description?: string;
  readonly active: boolean;
  /**
   * Where the row came from. `ORGANIZATION` means it is this org's own client
   * or a child's — the entitlement is what put it here, so it is the one an
   * operator is almost always looking for. `DIRECTORY` rows are suggestions
   * from the applications service that no org is bound to yet.
   */
  readonly source?: "ORGANIZATION" | "DIRECTORY";
}

export interface M2MClientDirectory {
  readonly data: readonly M2MClientOption[];
  /**
   * Only set by the local fixture path (`MIOT_AUTH0_ADMIN_MODE=stub`). Worth
   * saying out loud in the UI so nobody saves a fabricated client id believing
   * it resolves.
   */
  readonly source?: "stub" | "service";
  /**
   * From the modulith: whether the optional applications service is wired up.
   * False means the list is the organization-derived half only — which is
   * complete for the common case, so it is context rather than a warning.
   */
  readonly directoryEnabled?: boolean;
}

const base = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/auth0/m2m-clients`;

export async function fetchM2MClients(
  orgSlug: string,
  query: string
): Promise<M2MClientDirectory> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const url = params.toString()
    ? `${base(orgSlug)}?${params}`
    : base(orgSlug);

  const res = await fetch(url);
  if (!res.ok) {
    let message: string | undefined;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error;
    } catch {
      // non-JSON error body — fall back to the status message
    }
    throw new ApiError({ status: res.status, url, message });
  }
  return (await res.json()) as M2MClientDirectory;
}
