import type {
  GeocodingProviderName,
  PlatformGeocoding,
  SetPlatformGeocoding,
} from "./use-platform-geocoding";

/** The provider form as typed. */
export interface GeocodingDraft {
  provider: GeocodingProviderName;
  token: string;
  permanent: boolean;
  cost: string;
}

export type GeocodingDraftResult =
  | { ok: true; value: SetPlatformGeocoding }
  | { ok: false; error: "costInvalid" | "tokenRequired" };

const COST = /^\d{1,6}(\.\d{1,6})?$/;

export function geocodingDraftFrom(stored: PlatformGeocoding): GeocodingDraft {
  return {
    provider: stored.provider ?? "mapbox",
    token: "",
    permanent: stored.permanent ?? true,
    cost:
      stored.costPerRequestUsd === null ? "" : String(stored.costPerRequestUsd),
  };
}

/** The request body, or the first problem. A token is needed only the first time. */
export function toGeocodingRequest(
  draft: GeocodingDraft,
  configured: boolean
): GeocodingDraftResult {
  const token = draft.token.trim();
  if (!configured && token === "") return { ok: false, error: "tokenRequired" };
  const cost = draft.cost.trim();
  if (cost !== "" && !COST.test(cost)) {
    return { ok: false, error: "costInvalid" };
  }
  return {
    ok: true,
    value: {
      provider: draft.provider,
      token,
      permanent: draft.provider === "mapbox" ? draft.permanent : false,
      costPerRequestUsd: cost === "" ? null : Number(cost),
    },
  };
}
