/**
 * What a stored config has to be before it may enter the new store.
 *
 * The point of doing this once, on the way in, is that the store ends up
 * single-version by construction: nothing downstream has to carry a reader
 * for a shape that no longer exists.
 *
 * There is no v1 conversion here, and that is a finding rather than an
 * omission. The app that wrote these configs types its storage as
 * `version: 2` and carries no migration of its own — its only version check
 * refuses anything else outright. So either nothing older was ever written,
 * or it was already unreadable before this package existed. Guessing a shape
 * for it would invent data; refusing by name reports it instead, and the
 * import's dry run is what turns that question into a count.
 */

export const CURRENT_CONFIG_VERSION = 2;

export type MigrationResult =
  | { ok: true; config: unknown }
  | { ok: false; reason: string };

/** The `version` a stored config claims, or null when it claims none. */
function versionOf(config: unknown): number | null {
  if (typeof config !== "object" || config === null) return null;
  const value = (config as { version?: unknown }).version;
  return typeof value === "number" ? value : null;
}

/**
 * Accepts a config at the current version and refuses anything else, saying
 * what it saw. Refusing is deliberate: an import is one-way, and a config
 * silently coerced into the wrong shape is worse than one left behind.
 */
export function migrateConfig(config: unknown): MigrationResult {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return {
      ok: false,
      reason: `config is ${describe(config)}, not an object`,
    };
  }

  const version = versionOf(config);
  if (version === CURRENT_CONFIG_VERSION) return { ok: true, config };

  if (version === null) {
    return {
      ok: false,
      reason:
        "config carries no numeric version. Nothing here can tell what shape " +
        "it is, and assuming the current one would corrupt it silently",
    };
  }
  if (version < CURRENT_CONFIG_VERSION) {
    return {
      ok: false,
      reason:
        `config is version ${version} and no conversion to ` +
        `${CURRENT_CONFIG_VERSION} exists. Write one against a real example ` +
        "rather than guessing the old shape",
    };
  }
  return {
    ok: false,
    reason:
      `config is version ${version}, newer than the ${CURRENT_CONFIG_VERSION} ` +
      "this understands. It was written by something newer than this import",
  };
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}
