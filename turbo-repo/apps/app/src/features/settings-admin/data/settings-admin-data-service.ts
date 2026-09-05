"use client";

import { getJson, sendJson } from "./json-client";
import type {
  ContentReviewPermission,
  OrgMember,
  OrganizationRole,
  SetContentReviewPermission,
  SetOrganizationRole,
} from "../types";

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

const CONTENT_REVIEW_PERMISSION_CODE = "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE";

function organizationPermissionUrl(
  orgSlug: string,
  permissionCode: string
): string {
  return `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/permissions/${encodeURIComponent(permissionCode)}`;
}

function contentReviewPermissionUrl(orgSlug: string): string {
  return organizationPermissionUrl(orgSlug, CONTENT_REVIEW_PERMISSION_CODE);
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
  return sendJson<ContentReviewPermission>(
    "PUT",
    contentReviewPermissionUrl(orgSlug),
    value
  );
}

const ORGANIZATION_OWNER_ROLE_CODE = "ORGANIZATION_OWNER";

function organizationRoleUrl(orgSlug: string, roleCode: string): string {
  return `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/roles/${encodeURIComponent(roleCode)}`;
}

function organizationOwnerRoleUrl(orgSlug: string): string {
  return organizationRoleUrl(orgSlug, ORGANIZATION_OWNER_ROLE_CODE);
}

export function fetchOrganizationOwnerRole(
  orgSlug: string
): Promise<OrganizationRole> {
  return getJson<OrganizationRole>(organizationOwnerRoleUrl(orgSlug));
}

export function updateOrganizationOwnerRole(
  orgSlug: string,
  value: SetOrganizationRole
): Promise<OrganizationRole> {
  return sendJson<OrganizationRole>(
    "PUT",
    organizationOwnerRoleUrl(orgSlug),
    value
  );
}
