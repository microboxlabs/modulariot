"use client";

import type { OrgMember, ModuleCode } from "../types";

/**
 * Thin client-side fetch wrappers around the Next.js admin proxy routes.
 * Throw on non-2xx so SWR can surface the error to the UI.
 */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export function fetchOrgMembers(orgSlug: string): Promise<OrgMember[]> {
  return getJson<OrgMember[]>(
    `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/members`,
  );
}

export function fetchOrgModules(orgSlug: string): Promise<ModuleCode[]> {
  return getJson<ModuleCode[]>(
    `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/modules`,
  );
}
