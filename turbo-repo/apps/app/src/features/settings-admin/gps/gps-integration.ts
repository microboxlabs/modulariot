"use client";

import useSWR from "swr";
import { getJson, sendJson } from "../data/json-client";

/** Mirrors `OrgGpsResource.IntegrationView`. */
export interface GpsIntegration {
  clientId: string;
  audience: string | null;
  tokenUrl: string | null;
  trackUrl: string | null;
  /** Position endpoint that takes an API key; null when the deployment has none. */
  keyTrackUrl: string | null;
  scopes: string[];
  /** Whether the secret can be revealed and rotated here. */
  secretAvailable: boolean;
}

const INTEGRATION = "/app/api/gps/integration";

/** Shown in the examples until the owner reveals the secret. */
export const SECRET_PLACEHOLDER = "<client_secret>";
export const KEY_PLACEHOLDER = "<miot_sk_...>";

/** Fetches only when `enabled`: the caller may view the GPS module. */
export function useGpsIntegration(enabled: boolean) {
  return useSWR<GpsIntegration>(enabled ? INTEGRATION : null, getJson, {
    revalidateOnFocus: false,
  });
}

export async function revealSecret(): Promise<string> {
  const { clientSecret } = await sendJson<{ clientSecret: string }>(
    "POST",
    `${INTEGRATION}/secret`,
    {}
  );
  return clientSecret;
}

export async function rotateSecret(): Promise<string> {
  const { clientSecret } = await sendJson<{ clientSecret: string }>(
    "POST",
    `${INTEGRATION}/secret/rotate`,
    {}
  );
  return clientSecret;
}

/** The token request body, as the provider sends it. */
export function credentialsJson(
  integration: GpsIntegration,
  secret: string | null
): string {
  return JSON.stringify(
    {
      client_id: integration.clientId,
      client_secret: secret ?? SECRET_PLACEHOLDER,
      audience: integration.audience ?? "",
      grant_type: "client_credentials",
    },
    null,
    2
  );
}

/** `curl` that gets a token for the client. */
export function tokenCurl(
  integration: GpsIntegration,
  secret: string | null
): string {
  const body = credentialsJson(integration, secret)
    .split("\n")
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join("\n");
  return [
    "curl --request POST \\",
    `  --url ${integration.tokenUrl ?? "<token_url>"} \\`,
    "  --header 'content-type: application/json' \\",
    `  --data '${body}'`,
  ].join("\n");
}

/** `curl` that sends one position, authorized with `authorization`. */
export function trackCurl(url: string | null, authorization: string): string {
  return [
    "curl --request POST \\",
    `  --url ${url ?? "<track_url>"} \\`,
    `  --header 'Authorization: Bearer ${authorization}' \\`,
    "  --header 'content-type: application/json' \\",
    "  --header 'X-Request-Id: 6f1c2b7e-0d1a-4a8e-9a43-2f0e8c1d5b10' \\",
    "  --header 'X-Request-Timestamp: 1767225600' \\",
    "  --data '{",
    '    "asset_id": "ABCD12",',
    '    "timestamp": "2026-01-01T00:00:00Z",',
    '    "gps": { "latitude": -33.4489, "longitude": -70.6693, "speed": 54.2, "heading": 180 }',
    "  }'",
  ].join("\n");
}
