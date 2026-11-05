import { sendEmpty, sendJson } from "../data/json-client";

/** Mirrors `PlatformOrgGeocodingConnectionResource.ConnectionView`. */
export interface OrgGeocodingConnection {
  readonly connected: boolean;
  readonly connectionId: string | null;
  readonly name: string | null;
  readonly status: string | null;
}

function url(slug: string): string {
  return `/app/api/admin/platform/orgs/${encodeURIComponent(slug)}/geocoding-connection`;
}

/** Connects the organization to the platform's geocoding provider. Idempotent. */
export function connectManagedGeocoding(
  slug: string
): Promise<OrgGeocodingConnection> {
  return sendJson<OrgGeocodingConnection>("POST", url(slug), {});
}

/** Removes the organization's geocoding connection; its sites go to review. */
export function removeManagedGeocoding(slug: string): Promise<void> {
  return sendEmpty("DELETE", url(slug));
}
