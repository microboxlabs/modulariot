export const GEOGRAPHIC_PROFILE_IDS = ["admin", "other"] as const;

export type GeographicProfileId = (typeof GEOGRAPHIC_PROFILE_IDS)[number];

export const GEOGRAPHIC_CAPABILITIES = ["placesEditor"] as const;

export type GeographicCapability = (typeof GEOGRAPHIC_CAPABILITIES)[number];

export type GeographicProfile = {
  id: GeographicProfileId;
  enabled: boolean;
  capabilities: readonly GeographicCapability[];
};

export const GEOGRAPHIC_PROFILES: Record<
  GeographicProfileId,
  GeographicProfile
> = {
  admin: {
    id: "admin",
    enabled: true,
    capabilities: ["placesEditor"],
  },
  other: {
    id: "other",
    enabled: false,
    capabilities: [],
  },
};

export const DEFAULT_GEOGRAPHIC_PROFILE: GeographicProfileId = "admin";

export function profileHasCapability(
  profileId: GeographicProfileId,
  capability: GeographicCapability
): boolean {
  return GEOGRAPHIC_PROFILES[profileId].capabilities.includes(capability);
}
