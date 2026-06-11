/**
 * Auth0 connection names, configurable per deployment via environment
 * variables. The defaults preserve the values that were previously hardcoded
 * so existing deployments keep working without new configuration.
 */

const DEFAULT_CONNECTIONS = {
  google: "google-oauth2",
  github: "github",
  entraId: "Mintral-Entra-ID",
  credentials: "Username-Password-Authentication",
} as const;

function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

/**
 * Maps UI provider IDs to Auth0 connection names.
 * All identity providers are routed through Auth0 as the single OIDC broker.
 * Returns undefined for providers not brokered through Auth0.
 */
export function getAuth0Connection(providerId: string): string | undefined {
  switch (providerId) {
    case "google":
      return envOr("AUTH_AUTH0_CONNECTION_GOOGLE", DEFAULT_CONNECTIONS.google);
    case "github":
      return envOr("AUTH_AUTH0_CONNECTION_GITHUB", DEFAULT_CONNECTIONS.github);
    case "microsoft-entra-id":
    case "microsoft":
      return envOr("AUTH_AUTH0_CONNECTION_ENTRA_ID", DEFAULT_CONNECTIONS.entraId);
    default:
      return undefined;
  }
}

/** The Auth0 database connection used for username/password sign-in. */
export function getCredentialsConnection(): string {
  return envOr(
    "AUTH_AUTH0_CONNECTION_CREDENTIALS",
    DEFAULT_CONNECTIONS.credentials
  );
}

/** True when the Auth0 OIDC client is fully configured for this deployment. */
export function isAuth0Configured(): boolean {
  return !!(
    process.env.AUTH_AUTH0_ID &&
    process.env.AUTH_AUTH0_SECRET &&
    process.env.AUTH_AUTH0_ISSUER
  );
}
