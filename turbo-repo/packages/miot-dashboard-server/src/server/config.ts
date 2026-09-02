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
  /**
   * Where dashboards live. `memory` forgets everything on restart and is the
   * default because it needs nothing; `sqlite` persists to one file and needs
   * nothing either, which is what makes it a deployment rather than a demo.
   */
  store: StoreKind;
  /** Database file for the sqlite store. Ignored by the memory store. */
  sqlitePath: string;
  /** Seed file, so a dev server can start with data. */
  seedPath: string | undefined;
  /** Serve the contract at /openapi.yaml and render it at /docs. */
  docs: boolean;
}

export const STORE_KINDS = ["memory", "sqlite"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

/**
 * Default database file — relative, and deliberately neither a hostname nor a
 * credential. It is the one piece of storage configuration that can carry a
 * default without one deployment quietly inheriting another's.
 */
export const DEFAULT_SQLITE_PATH = "./data/dashboards.db";

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

/** `[::1]` and `::1` are the same address written two ways. */
function stripBrackets(host: string): string {
  return host.length >= 2 && host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}

/**
 * Whether a bind address reaches only this machine.
 *
 * The whole 127.0.0.0/8 block is loopback, not just 127.0.0.1. `0.0.0.0` and
 * `::` are the opposite — they bind every interface — and an empty host means
 * the same thing to Node, so it is refused rather than guessed at.
 */
function isLoopbackHost(host: string): boolean {
  const address = stripBrackets(host.trim().toLowerCase());
  if (address === "localhost" || address === "::1") return true;
  return address.startsWith("127.");
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
  const host = env.HOST ?? "127.0.0.1";

  if (insecureAuth && env.NODE_ENV === "production") {
    throw new ConfigError(
      "MIOT_DASHBOARD_INSECURE_AUTH cannot be enabled when NODE_ENV=production. " +
        "It accepts any identity from request headers without verification.",
    );
  }

  // NODE_ENV is not a security boundary — it is an environment variable nobody
  // has to set. The reachable-from-elsewhere check is the one that holds
  // regardless: with unverified header auth, anyone who can open a socket to
  // this port is already every user in every tenant, so the port must not
  // leave the machine.
  if (insecureAuth && !isLoopbackHost(host)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_INSECURE_AUTH cannot be enabled while listening on "${host}". ` +
        "It accepts any identity from request headers without verification, so " +
        "anyone who can reach the port can act as any user in any tenant. Bind " +
        "to a loopback address (the 127.0.0.0/8 default, ::1 or localhost), or " +
        "configure a real identity provider.",
    );
  }

  const store = env.MIOT_DASHBOARD_STORE ?? "memory";
  if (!(STORE_KINDS as readonly string[]).includes(store)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_STORE="${store}" is not supported. Choose one of: ` +
        `${STORE_KINDS.join(", ")}. A PostgreSQL store lands with P2b-3.`,
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
    host,
    basePath: env.MIOT_DASHBOARD_BASE_PATH ?? "",
    insecureAuth,
    store: store as StoreKind,
    sqlitePath: env.MIOT_DASHBOARD_SQLITE_PATH ?? DEFAULT_SQLITE_PATH,
    seedPath: env.MIOT_DASHBOARD_SEED,
    docs: readBooleanUnlessDisabled(env.MIOT_DASHBOARD_DOCS),
  };
}
