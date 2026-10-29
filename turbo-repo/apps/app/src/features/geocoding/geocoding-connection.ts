import { z } from "zod/v3";
import type {
  ChannelCreate,
  ChannelUpdate,
  IntegrationConnection,
} from "@/features/settings-admin/channels/channel.types";

export const GEOCODING_PROVIDER = "GEOCODING";

/** The geocoder sends the token only to the provider's configured host; these are its defaults. */
export const GEOCODING_BASE_URLS = {
  mapbox: "https://api.mapbox.com",
  google: "https://maps.googleapis.com",
} as const;

export type GeocodingProviderName = keyof typeof GEOCODING_BASE_URLS;

/** The organization's GEOCODING connection, on the modulith that runs trips. */
export const geocodingIntegrationsBase = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/geocoding/integrations`;

const COST = /^\d{1,6}(\.\d{1,6})?$/;

/** `token` blank on edit keeps the stored one; on create it is required (checked by the modal). */
export const GeocodingConnectionSchema = z.object({
  name: z.string().min(1, "validation.nameRequired"),
  provider: z.enum(["mapbox", "google"]),
  token: z.string(),
  permanent: z.boolean(),
  cost: z
    .string()
    .refine(
      (v) => v.trim() === "" || COST.test(v.trim()),
      "validation.costInvalid"
    ),
});

export type GeocodingFormData = z.infer<typeof GeocodingConnectionSchema>;

export const GEOCODING_DEFAULTS: GeocodingFormData = {
  name: "",
  provider: "mapbox",
  token: "",
  permanent: true,
  cost: "",
};

/** What `GeocodingConnection` reads: `provider`, `permanent` (Mapbox only) and `costPerRequestUsd`. */
function geocodingMetadata(form: GeocodingFormData): Record<string, unknown> {
  const metadata: Record<string, unknown> = { provider: form.provider };
  if (form.provider === "mapbox") metadata.permanent = form.permanent;
  const cost = form.cost.trim();
  if (cost) metadata.costPerRequestUsd = cost;
  return metadata;
}

export function geocodingCreate(form: GeocodingFormData): ChannelCreate {
  return {
    name: form.name.trim(),
    baseUrl: GEOCODING_BASE_URLS[form.provider],
    token: form.token.trim(),
    credentialName: form.name.trim(),
    credentialPublicConfig: { provider: form.provider },
    metadata: geocodingMetadata(form),
  };
}

export function geocodingUpdate(form: GeocodingFormData): ChannelUpdate {
  return {
    name: form.name.trim(),
    baseUrl: GEOCODING_BASE_URLS[form.provider],
    token: form.token.trim() || undefined,
    metadata: geocodingMetadata(form),
  };
}

export function geocodingProviderOf(
  connection: IntegrationConnection
): GeocodingProviderName {
  return connection.metadata?.provider === "google" ? "google" : "mapbox";
}

export function geocodingToForm(
  connection: IntegrationConnection
): GeocodingFormData {
  const { permanent, costPerRequestUsd } = connection.metadata ?? {};
  return {
    name: connection.name,
    provider: geocodingProviderOf(connection),
    token: "",
    permanent: permanent !== false && permanent !== "false",
    cost:
      typeof costPerRequestUsd === "string" ||
      typeof costPerRequestUsd === "number"
        ? String(costPerRequestUsd)
        : "",
  };
}
