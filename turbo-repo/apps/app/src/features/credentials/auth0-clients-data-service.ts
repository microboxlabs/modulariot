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
}

export interface M2MClientDirectory {
  readonly data: readonly M2MClientOption[];
  /**
   * Which backend answered. `stub` means the auth0 service has no live endpoint
   * yet and the list is fixtures — worth saying out loud in the UI so nobody
   * saves a fabricated client id believing it resolves.
   */
  readonly source: "stub" | "service";
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
