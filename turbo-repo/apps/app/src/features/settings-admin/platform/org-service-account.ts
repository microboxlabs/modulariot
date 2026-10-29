"use client";

import useSWR from "swr";
import { getJson, sendJson, type ApiError } from "../data/json-client";

export interface OrgServiceAccountView {
  readonly email: string;
  readonly accountId: string;
  readonly disabled: boolean;
  readonly createdAt: string | null;
  readonly createdBy: string | null;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

/** `account` is null until one is created; `configured` is false when the platform has no project set. */
export interface OrgServiceAccountState {
  readonly configured: boolean;
  readonly projectId: string | null;
  readonly account: OrgServiceAccountView | null;
}

export interface OrgServiceAccountCheck {
  readonly disabled: boolean;
  readonly tokenExpiresAt: string | null;
}

export type OrgServiceAccountAction = "disable" | "enable";

function url(slug: string, action?: string): string {
  const base = `/app/api/admin/platform/orgs/${encodeURIComponent(slug)}/service-account`;
  return action ? `${base}/${action}` : base;
}

export function orgServiceAccountKey(slug: string) {
  return ["platform-org-service-account", slug] as const;
}

/** Fetches only when `enabled` (a platform owner). */
export function useOrgServiceAccount(slug: string, enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<
    OrgServiceAccountState,
    ApiError
  >(
    enabled ? orgServiceAccountKey(slug) : null,
    () => getJson<OrgServiceAccountState>(url(slug)),
    { revalidateOnFocus: false }
  );
  return { state: data, error, isLoading, mutate };
}

export function setOrgServiceAccount(
  slug: string,
  action: OrgServiceAccountAction
): Promise<OrgServiceAccountState> {
  return sendJson<OrgServiceAccountState>("POST", url(slug, action), {});
}

export interface ManagedBigQueryConnection {
  readonly connectionId: string;
  readonly name: string;
  readonly status: string;
  readonly tested: boolean;
  readonly testMessage: string | null;
}

/** Creates the account if missing and the organization's BigQuery connection that queries as it. */
export function connectManagedBigQuery(
  slug: string
): Promise<ManagedBigQueryConnection> {
  return sendJson<ManagedBigQueryConnection>(
    "POST",
    url(slug, "bigquery-connection"),
    {}
  );
}

export function checkOrgServiceAccount(
  slug: string
): Promise<OrgServiceAccountCheck> {
  return sendJson<OrgServiceAccountCheck>("POST", url(slug, "check"), {});
}
