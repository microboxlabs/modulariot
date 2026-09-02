/**
 * Assembly: environment variables in, seam implementations out.
 *
 * The library takes seam objects. The standalone server has only environment
 * variables, so this module is the one place that turns the second into the
 * first. Keeping it separate means the library never grows an opinion about
 * configuration, and the server never grows an opinion about authorization.
 */

export interface ServerConfig {
  port: number;
  host: string;
  basePath: string;
  /**
   * Whether to trust identity headers with no verification. Off unless
   * explicitly set, and refused outright when NODE_ENV is production.
   */
  insecureAuth: boolean;
  /** Where dashboards live. Only "memory" exists today; Postgres lands in P2b. */
  store: "memory";
  /** Seed file for the in-memory store, so a dev server can start with data. */
  seedPath: string | undefined;
  /** Serve the contract at /openapi.yaml and render it at /docs. */
  docs: boolean;
}

export class ConfigError extends Error {}

export interface ConfigEnv {
  [key: string]: string | undefined;
}

function readPort(env: ConfigEnv): number {
  const raw = env.PORT ?? "3070";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(
      `PORT must be an integer between 1 and 65535, got "${raw}"`,
    );
  }
  return port;
}

function readBoolean(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

/**
 * For switches that are on unless someone says otherwise.
 *
 * Kept separate from `readBoolean` rather than given a default parameter: a
 * dangerous switch must be off unless explicitly enabled, and reading the two
 * defaults out of one function is how those get confused.
 */
function readBooleanUnlessDisabled(value: string | undefined): boolean {
  if (value === undefined) return true;
  return !(value === "0" || value.toLowerCase() === "false");
}

/**
 * Read configuration, refusing anything unsafe rather than warning about it.
 *
 * The insecure identity resolver is the one genuinely dangerous switch in this
 * package: it lets any caller claim any user in any tenant. It is refused in
 * production outright, because a warning in a log is not a control.
 */
export function readServerConfig(env: ConfigEnv): ServerConfig {
  const insecureAuth = readBoolean(env.MIOT_DASHBOARD_INSECURE_AUTH);

  if (insecureAuth && env.NODE_ENV === "production") {
    throw new ConfigError(
      "MIOT_DASHBOARD_INSECURE_AUTH cannot be enabled when NODE_ENV=production. " +
        "It accepts any identity from request headers without verification.",
    );
  }

  const store = env.MIOT_DASHBOARD_STORE ?? "memory";
  if (store !== "memory") {
    throw new ConfigError(
      `MIOT_DASHBOARD_STORE="${store}" is not supported yet. Only "memory" exists; a Postgres store lands with P2b.`,
    );
  }

  if (!insecureAuth) {
    throw new ConfigError(
      "No identity provider is configured. The standalone server currently ships " +
        "only the insecure header resolver, which must be opted into with " +
        "MIOT_DASHBOARD_INSECURE_AUTH=true and is for local use only. " +
        "A verifying resolver lands with P2b.",
    );
  }

  return {
    port: readPort(env),
    host: env.HOST ?? "127.0.0.1",
    basePath: env.MIOT_DASHBOARD_BASE_PATH ?? "",
    insecureAuth,
    store,
    seedPath: env.MIOT_DASHBOARD_SEED,
    docs: readBooleanUnlessDisabled(env.MIOT_DASHBOARD_DOCS),
  };
}
