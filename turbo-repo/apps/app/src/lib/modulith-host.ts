/**
 * Base host of the Quarkus modulith gateway — no path: callers append their
 * own (`/api/v1/orgs/{slug}/harness`, `/interactions/episodes`, …).
 *
 * Server-only, deliberately not `NEXT_PUBLIC_`. Read per call rather than at
 * module scope so tests can stub it without ordering their imports.
 */
export function modulithHost(): string {
  return process.env.MIOT_MODULITH_URL ?? "";
}

/** Callers guard on this instead of throwing — the features built on the host
 * degrade when it's missing: search and chat disable themselves, telemetry
 * no-ops. */
export function isModulithConfigured(): boolean {
  return modulithHost() !== "";
}
