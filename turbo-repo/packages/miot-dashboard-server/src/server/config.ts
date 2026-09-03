/**
 * Assembly: environment variables in, seam implementations out.
 *
 * The library takes seam objects. The standalone server has only environment
 * variables, so this module is the one place that turns the second into the
 * first. Keeping it separate means the library never grows an opinion about
 * configuration, and the server never grows an opinion about authorization.
 */

import type { JwtAlgorithm } from "../identity/jwt";

export interface ServerConfig {
  port: number;
  host: string;
  basePath: string;
  /** Which identity provider the server was told to use. */
  auth: AuthConfig;
  /** `memory` is discarded on restart; `sqlite` writes to one file. */
  store: StoreKind;
  /** Database file for the sqlite store. Ignored by the memory store. */
  sqlitePath: string;
  /** Seed file, so a dev server can start with data. */
  seedPath: string | undefined;
  /** Serve the contract at /openapi.yaml and render it at /docs. */
  docs: boolean;
}

export type AuthConfig = InsecureAuthConfig | JwtAuthConfig;

/** Identity read from request headers, unverified. Loopback only. */
export interface InsecureAuthConfig {
  kind: "insecure";
}

export interface JwtAuthConfig {
  kind: "jwt";
  issuer: string;
  audience: string[];
  /**
   * Derived from the key source rather than configured: a JWKS endpoint or a
   * public key means RS256, a shared secret means HS256. Deriving it is what
   * makes "accept either" impossible to express, and "accept either" is the
   * algorithm-confusion attack.
   */
  algorithm: JwtAlgorithm;
  key: JwtKeySource;
  claims: {
    tenantId: string;
    userId: string | undefined;
    groups: string | undefined;
    displayName: string | undefined;
  };
  clockToleranceSeconds: number;
}

export type JwtKeySource =
  | { kind: "jwks"; url: string }
  | { kind: "publicKey"; pem: string }
  | { kind: "secret"; secret: string };

export const STORE_KINDS = ["memory", "sqlite"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

/** A relative path, so the default contains no hostname and no credential. */
export const DEFAULT_SQLITE_PATH = "./data/dashboards.db";

export const DEFAULT_CLOCK_TOLERANCE_SECONDS = 30;

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

const trimmed = (value: string | undefined): string | undefined => {
  const text = value?.trim();
  return text === undefined || text.length === 0 ? undefined : text;
};

/** Every variable that only means anything to the JWT resolver. */
const JWT_ENV_KEYS = [
  "MIOT_DASHBOARD_JWT_ISSUER",
  "MIOT_DASHBOARD_JWT_AUDIENCE",
  "MIOT_DASHBOARD_JWT_JWKS_URL",
  "MIOT_DASHBOARD_JWT_PUBLIC_KEY",
  "MIOT_DASHBOARD_JWT_SECRET",
  "MIOT_DASHBOARD_JWT_TENANT_CLAIM",
  "MIOT_DASHBOARD_JWT_USER_CLAIM",
  "MIOT_DASHBOARD_JWT_GROUPS_CLAIM",
  "MIOT_DASHBOARD_JWT_NAME_CLAIM",
  "MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE",
] as const;

function required(env: ConfigEnv, key: string, why: string): string {
  const value = trimmed(env[key]);
  if (value === undefined) throw new ConfigError(`${key} is required: ${why}`);
  return value;
}

/**
 * A PEM pasted into an environment variable usually arrives with its newlines
 * written as the two characters `\` and `n`, because most secret stores and
 * shells cannot carry a real one.
 */
function unescapeNewlines(pem: string): string {
  return pem.includes("\\n") ? pem.split("\\n").join("\n") : pem;
}

function readKeySource(env: ConfigEnv): JwtKeySource {
  const jwks = trimmed(env.MIOT_DASHBOARD_JWT_JWKS_URL);
  const publicKey = trimmed(env.MIOT_DASHBOARD_JWT_PUBLIC_KEY);
  const secret = trimmed(env.MIOT_DASHBOARD_JWT_SECRET);

  const configured = [
    jwks === undefined ? null : "MIOT_DASHBOARD_JWT_JWKS_URL",
    publicKey === undefined ? null : "MIOT_DASHBOARD_JWT_PUBLIC_KEY",
    secret === undefined ? null : "MIOT_DASHBOARD_JWT_SECRET",
  ].filter((name): name is string => name !== null);

  if (configured.length === 0) {
    throw new ConfigError(
      "JWT authentication needs a key. Set exactly one of " +
        "MIOT_DASHBOARD_JWT_JWKS_URL (RS256, the usual choice), " +
        "MIOT_DASHBOARD_JWT_PUBLIC_KEY (RS256 from a pasted PEM, for a " +
        "cluster with no egress) or MIOT_DASHBOARD_JWT_SECRET (HS256).",
    );
  }
  if (configured.length > 1) {
    throw new ConfigError(
      `Set exactly one JWT key source; found ${configured.join(" and ")}. ` +
        "Accepting more than one algorithm at a time is the attack this " +
        "server is built to refuse: the RS256 public key is published, and a " +
        "verifier that also accepts HS256 will take it as a shared secret.",
    );
  }

  if (jwks !== undefined) return { kind: "jwks", url: jwks };
  if (publicKey !== undefined) {
    return { kind: "publicKey", pem: unescapeNewlines(publicKey) };
  }
  return { kind: "secret", secret: secret as string };
}

function readClockTolerance(env: ConfigEnv): number {
  const raw = trimmed(env.MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE);
  if (raw === undefined) return DEFAULT_CLOCK_TOLERANCE_SECONDS;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 300) {
    throw new ConfigError(
      "MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE must be a whole number of seconds " +
        `between 0 and 300, got "${raw}". It widens the window in which an ` +
        "expired token is still accepted, so it is capped.",
    );
  }
  return seconds;
}

function readJwtAuth(env: ConfigEnv): JwtAuthConfig {
  const audience = required(
    env,
    "MIOT_DASHBOARD_JWT_AUDIENCE",
    "the API identifier this server's tokens are minted for. Without it, any " +
      "token the issuer signed for any of its APIs would be accepted here.",
  )
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (audience.length === 0) {
    throw new ConfigError(
      "MIOT_DASHBOARD_JWT_AUDIENCE must name at least one audience",
    );
  }

  const key = readKeySource(env);

  return {
    kind: "jwt",
    issuer: required(
      env,
      "MIOT_DASHBOARD_JWT_ISSUER",
      "the issuer whose tokens this server accepts, exactly as the tokens " +
        'spell it (for Auth0, "https://<tenant>.auth0.com/").',
    ),
    audience,
    algorithm: key.kind === "secret" ? "HS256" : "RS256",
    key,
    claims: {
      tenantId: required(
        env,
        "MIOT_DASHBOARD_JWT_TENANT_CLAIM",
        "the claim carrying the tenant. No registered claim carries one and " +
          "every provider spells it differently, so there is no default: a " +
          "wrong guess would silently put every caller in the same tenant.",
      ),
      userId: trimmed(env.MIOT_DASHBOARD_JWT_USER_CLAIM),
      groups: trimmed(env.MIOT_DASHBOARD_JWT_GROUPS_CLAIM),
      displayName: trimmed(env.MIOT_DASHBOARD_JWT_NAME_CLAIM),
    },
    clockToleranceSeconds: readClockTolerance(env),
  };
}

/**
 * Pick the identity provider, refusing anything unsafe rather than warning
 * about it.
 *
 * The insecure resolver is the one genuinely dangerous switch in this
 * package: it lets any caller claim any user in any tenant.
 */
function readAuth(env: ConfigEnv, host: string): AuthConfig {
  const insecure = readBoolean(env.MIOT_DASHBOARD_INSECURE_AUTH);
  const jwtKeys = JWT_ENV_KEYS.filter((key) => trimmed(env[key]) !== undefined);

  if (insecure && jwtKeys.length > 0) {
    throw new ConfigError(
      "Two identity providers are configured: MIOT_DASHBOARD_INSECURE_AUTH " +
        `is on and ${jwtKeys.join(", ")} is set. Unset one — a server that ` +
        "silently preferred either would be verifying tokens in one " +
        "environment and trusting headers in another.",
    );
  }

  if (insecure) {
    if (env.NODE_ENV === "production") {
      throw new ConfigError(
        "MIOT_DASHBOARD_INSECURE_AUTH cannot be enabled when NODE_ENV=production. " +
          "It accepts any identity from request headers without verification.",
      );
    }

    // NODE_ENV is not a security boundary — it is an environment variable
    // nobody has to set. The reachable-from-elsewhere check is the one that
    // holds regardless: with unverified header auth, anyone who can open a
    // socket to this port is already every user in every tenant, so the port
    // must not leave the machine.
    if (!isLoopbackHost(host)) {
      throw new ConfigError(
        `MIOT_DASHBOARD_INSECURE_AUTH cannot be enabled while listening on "${host}". ` +
          "It accepts any identity from request headers without verification, so " +
          "anyone who can reach the port can act as any user in any tenant. Bind " +
          "to a loopback address (the 127.0.0.0/8 default, ::1 or localhost), or " +
          "configure a real identity provider.",
      );
    }
    return { kind: "insecure" };
  }

  if (jwtKeys.length > 0) return readJwtAuth(env);

  throw new ConfigError(
    "No identity provider is configured. Either set MIOT_DASHBOARD_JWT_ISSUER, " +
      "MIOT_DASHBOARD_JWT_AUDIENCE, MIOT_DASHBOARD_JWT_TENANT_CLAIM and one key " +
      "source (MIOT_DASHBOARD_JWT_JWKS_URL, MIOT_DASHBOARD_JWT_PUBLIC_KEY or " +
      "MIOT_DASHBOARD_JWT_SECRET) to verify bearer tokens, or opt into " +
      "MIOT_DASHBOARD_INSECURE_AUTH=true, which reads identity from request " +
      "headers without verification and is for local use only.",
  );
}

export function readServerConfig(env: ConfigEnv): ServerConfig {
  const host = env.HOST ?? "127.0.0.1";
  const auth = readAuth(env, host);

  const store = env.MIOT_DASHBOARD_STORE ?? "memory";
  if (!(STORE_KINDS as readonly string[]).includes(store)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_STORE="${store}" is not supported. Choose one of: ` +
        `${STORE_KINDS.join(", ")}. A PostgreSQL store lands with P2b-3.`,
    );
  }

  return {
    port: readPort(env),
    host,
    basePath: env.MIOT_DASHBOARD_BASE_PATH ?? "",
    auth,
    store: store as StoreKind,
    sqlitePath: env.MIOT_DASHBOARD_SQLITE_PATH ?? DEFAULT_SQLITE_PATH,
    seedPath: env.MIOT_DASHBOARD_SEED,
    docs: readBooleanUnlessDisabled(env.MIOT_DASHBOARD_DOCS),
  };
}
