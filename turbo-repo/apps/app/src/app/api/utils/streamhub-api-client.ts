import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

// Common configuration for StreamHub API authentication
const getAuthConfig = (): AuthTokenConfig => ({
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
});

// Shared AuthToken instance
const authToken = new AuthToken(getAuthConfig());

/**
 * The shared StreamHub M2M token. Used by `pgrest-client.ts` and the
 * ext-tasks acknowledge handler.
 */
export function getSharedAuthToken() {
  return authToken;
}
