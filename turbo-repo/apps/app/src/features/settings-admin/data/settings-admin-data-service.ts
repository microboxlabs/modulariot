"use client";

import type {
  ContentReviewPermission,
  OrgMember,
  SetContentReviewPermission,
} from "../types";

/**
 * Thin client-side fetch wrappers around the Next.js admin proxy routes.
 * Throw on non-2xx so SWR can surface the error to the UI.
 */

interface ApiErrorOptions {
  readonly status: number;
  readonly url: string;
  readonly message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor({ status, url, message }: ApiErrorOptions) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

export function fetchOrgMembers(orgSlug: string): Promise<OrgMember[]> {
  return getJson<OrgMember[]>(
    `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/members`
  );
}

export function fetchOrgModules(orgSlug: string): Promise<string[]> {
  return getJson<string[]>(
    `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/modules`
  );
}

function contentReviewPermissionUrl(orgSlug: string): string {
  return `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/permissions/content-review-auto-approval`;
}

export function fetchContentReviewPermission(
  orgSlug: string
): Promise<ContentReviewPermission> {
  return getJson<ContentReviewPermission>(contentReviewPermissionUrl(orgSlug));
}

export function updateContentReviewPermission(
  orgSlug: string,
  value: SetContentReviewPermission
): Promise<ContentReviewPermission> {
  return putJson<ContentReviewPermission>(
    contentReviewPermissionUrl(orgSlug),
    value
  );
}
