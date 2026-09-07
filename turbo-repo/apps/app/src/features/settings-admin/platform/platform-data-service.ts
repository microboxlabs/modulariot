"use client";

import { ApiError, getJson, sendEmpty, sendJson } from "../data/json-client";
import { readLogoDataUrl } from "./domain-branding-form";
import {
  PLATFORM_OWNER_ROLE,
  type DomainBrandingAdmin,
  type PlatformRole,
  type LogoVariant,
  type PlatformRoleMembership,
  type SetDomainBranding,
} from "./platform.types";

/**
 * Client-side wrappers around the Next.js proxy routes for the platform-scope
 * admin API. These endpoints take no organization: a domain and a platform
 * role both span every tenant, and the modulith's `PlatformAuthorizer` is the
 * authorization boundary.
 */

const PLATFORM_BASE = "/app/api/admin/platform";

function domainUrl(domain: string): string {
  return `${PLATFORM_BASE}/branding/domains/${encodeURIComponent(domain)}`;
}

/** The platform roles the caller holds — empty for everyone but an owner. */
export function fetchMyPlatformRoles(): Promise<PlatformRoleMembership> {
  return getJson<PlatformRoleMembership>(`${PLATFORM_BASE}/roles/me`);
}

export function fetchPlatformOwnerRole(): Promise<PlatformRole> {
  return getJson<PlatformRole>(`${PLATFORM_BASE}/roles/${PLATFORM_OWNER_ROLE}`);
}

/**
 * Replaces the database-held owners wholesale. The configured bootstrap
 * owners are not part of this list and are unaffected.
 */
export function updatePlatformOwnerRole(
  assigneeIds: string[]
): Promise<PlatformRole> {
  return sendJson<PlatformRole>(
    "PUT",
    `${PLATFORM_BASE}/roles/${PLATFORM_OWNER_ROLE}`,
    { assigneeIds }
  );
}

export function fetchDomainBrandings(): Promise<DomainBrandingAdmin[]> {
  return getJson<DomainBrandingAdmin[]>(`${PLATFORM_BASE}/branding/domains`);
}

export function saveDomainBranding(
  domain: string,
  value: SetDomainBranding
): Promise<DomainBrandingAdmin> {
  return sendJson<DomainBrandingAdmin>("PUT", domainUrl(domain), value);
}

/** Removes the row, which reverts the domain to the bundled default logo. */
export function deleteDomainBranding(domain: string): Promise<void> {
  return sendEmpty("DELETE", domainUrl(domain));
}

/**
 * Where the settings UI reads a domain's stored logo. Carries the ETag as a
 * cache buster so a replaced logo shows immediately.
 */
export function domainLogoUrl(
  domain: string,
  logoEtag: string,
  variant: LogoVariant = "light"
): string {
  const dark = variant === "dark" ? "&variant=dark" : "";
  return `${domainUrl(domain)}/logo?v=${encodeURIComponent(logoEtag)}${dark}`;
}

/**
 * The stored logo, re-read as the `data:` URL a PUT carries.
 *
 * The admin list returns metadata only, so an edit that changes just the home
 * URL has no bytes to send — and `SetDomainBrandingRequest` requires them.
 * Rather than teach the API a partial update, the form resends what is
 * already stored.
 */
export async function fetchStoredLogoDataUrl(
  domain: string,
  logoEtag: string,
  variant: LogoVariant = "light"
): Promise<string> {
  const url = domainLogoUrl(domain, logoEtag, variant);
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return readLogoDataUrl(await res.blob());
}
