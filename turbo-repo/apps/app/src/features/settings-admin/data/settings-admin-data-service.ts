"use client";

import { getJson } from "./json-client";
import type { OrgMember } from "../types";

/**
 * Thin client-side fetch wrappers around the Next.js admin proxy routes.
 * Throw on non-2xx so SWR can surface the error to the UI.
 */

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
