"use client";

import useSWR from "swr";
import { getJson } from "../data/json-client";

export type OrgRole = "CARRIER" | "PROVIDER" | "OPERATOR";
export type EvidenceSource = "SIGNAL" | "TRIP" | "ACCREDITATION";
export type AccessReason = "REPORTER" | "OWNER" | "OPERATOR" | "LINKED";
export type RelationshipKind = "OPERATION" | "GPS_SERVICE";

/** Mirrors `OrgRef`. */
export interface OrgRef {
  id: string;
  name: string;
  roles: OrgRole[];
}

/** Mirrors `AssetAccess`: one piece of evidence that lets the organization see the asset. */
export interface AssetAccess {
  reason: AccessReason;
  source: EvidenceSource;
  reference: string | null;
  firstSeen: string;
  lastSeen: string;
  expiresAt: string;
}

/** Mirrors `AssetView`. */
export interface NetworkAsset {
  id: string;
  type: string | null;
  label: string | null;
  owner: OrgRef | null;
  providers: OrgRef[];
  access: AssetAccess[];
}

/** Mirrors `RelationshipView`. */
export interface NetworkRelationship {
  kind: RelationshipKind;
  role: OrgRole;
  counterpart: OrgRef;
  counterpartRole: OrgRole;
  sources: EvidenceSource[];
  firstSeen: string;
  lastSeen: string;
  expiresAt: string;
  active: boolean;
  assetCount: number;
}

const NETWORK = "/app/api/fleet/network";

/** Fetches only when `enabled`: the caller may view the network. */
export function useNetworkAssets(enabled: boolean) {
  return useSWR<NetworkAsset[]>(enabled ? `${NETWORK}/assets` : null, getJson, {
    revalidateOnFocus: false,
  });
}

/** Fetches only when `enabled`: the caller may view the network. */
export function useNetworkRelationships(enabled: boolean) {
  return useSWR<NetworkRelationship[]>(
    enabled ? `${NETWORK}/relationships` : null,
    getJson,
    { revalidateOnFocus: false }
  );
}

/** When the organization stops seeing the asset: the latest expiry among its reasons. */
export function accessExpiresAt(asset: NetworkAsset): string | null {
  let latest: string | null = null;
  for (const access of asset.access) {
    if (latest === null || access.expiresAt > latest) latest = access.expiresAt;
  }
  return latest;
}

/** Each reason once, in the order the API lists them. */
export function accessReasons(asset: NetworkAsset): AccessReason[] {
  return [...new Set(asset.access.map((a) => a.reason))];
}

/** Assets whose id, label, type or owner contains the text, ignoring case. */
export function filterAssets(
  assets: NetworkAsset[],
  text: string
): NetworkAsset[] {
  const needle = text.trim().toLowerCase();
  if (needle === "") return assets;
  return assets.filter((asset) =>
    [asset.id, asset.label, asset.type, asset.owner?.name].some((value) =>
      value?.toLowerCase().includes(needle)
    )
  );
}
