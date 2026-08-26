import { logger } from "@/lib/logger";

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
 * place that resolves the host and one place the deprecated name is handled.
 * Reading it per call (not at module scope) also keeps it stubbable in tests
 * without having to set the env before the module is imported.
 */

const CURRENT_VAR = "MIOT_MODULITH_URL";
/**
 * Former name, from when the harness was this host's only consumer — it also
 * serves episode telemetry and knowledge candidates, neither of which is
 * under `/harness`. Still honoured so a deployment whose environment hasn't
 * been updated keeps working; environment variables for those environments
 * live in GitHub Environments, outside this repo, so the rename can't be
 * completed by a code change alone. Drop this once every environment sets
 * MIOT_MODULITH_URL — see #1126.
 */
const DEPRECATED_VAR = "MIOT_HARNESS_URL";

let deprecationWarned = false;

export function modulithHost(): string {
  const current = process.env[CURRENT_VAR];
  if (current) return current;

  const deprecated = process.env[DEPRECATED_VAR];
  if (deprecated) {
    if (!deprecationWarned) {
      deprecationWarned = true;
      logger.warn(
        { deprecated: DEPRECATED_VAR, replacement: CURRENT_VAR },
        `[modulith] ${DEPRECATED_VAR} is deprecated — set ${CURRENT_VAR} instead`,
      );
    }
    return deprecated;
  }

  return "";
}

/**
 * True when a modulith host is configured at all. The features built on it
 * degrade rather than fail — harness search and chat disable themselves,
 * episode telemetry no-ops — so callers check this instead of throwing.
 */
export function isModulithConfigured(): boolean {
  return modulithHost() !== "";
}
