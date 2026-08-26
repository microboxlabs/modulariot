/** Base host of the Quarkus modulith gateway — no path; callers append their
 * own (`/api/v1/orgs/{slug}/harness`, `/interactions/episodes`, …). */
export function modulithHost(): string {
  return process.env.MIOT_MODULITH_URL ?? "";
}

/** Features built on the host degrade when it's missing rather than failing,
 * so callers guard on this instead of throwing. */
export function isModulithConfigured(): boolean {
  return modulithHost() !== "";
}
