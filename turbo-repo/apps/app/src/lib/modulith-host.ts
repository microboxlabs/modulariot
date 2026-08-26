/**
 * Base host of the Quarkus modulith gateway — scheme and authority only, no
 * path. Callers append their own API path (`/api/v1/orgs/{slug}/harness`,
 * `/api/v1/orgs/{slug}/interactions/episodes`, …); the org and tenant are
 * resolved by the backend from the authenticated session, never pinned here.
 *
 * Server-only. Deliberately not `NEXT_PUBLIC_`: the browser never reaches the
 * modulith directly, every call goes through a route handler that holds the
 * user's token.
 *
 * Read through this helper rather than `process.env` directly, so there's one
 * place that resolves the host. Reading it per call (not at module scope)
 * also keeps it stubbable in tests without having to set the env before the
 * module is imported.
 */
export function modulithHost(): string {
  return process.env.MIOT_MODULITH_URL ?? "";
}

/**
 * True when a modulith host is configured at all. The features built on it
 * degrade rather than fail — harness search and chat disable themselves,
 * episode telemetry no-ops — so callers check this instead of throwing.
 */
export function isModulithConfigured(): boolean {
  return modulithHost() !== "";
}
