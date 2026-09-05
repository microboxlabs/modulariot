/**
 * Assembly: environment variables in, seam implementations out.
 *
 * The library takes seam objects. The standalone server has only environment
 * variables, so this module is the one place that turns the second into the
 * first. Keeping it separate means the library never grows an opinion about
 * configuration, and the server never grows an opinion about authorization.
 */

import type { JwtAlgorithm } from "../identity/jwt";
import type {
  TicketPresentation,
  TicketTenantSource,
} from "../identity/ticket";
import { DASHBOARD_ROLES, type DashboardRole } from "../access/roles";
import { isLoopbackHost } from "../net/loopback";

export interface ServerConfig {
  port: number;
  host: string;
  basePath: string;
  /** Which identity provider the server was told to use. */
  auth: AuthConfig;
  /** Where scope membership is answered: the seed file, or the host. */
  scopes: ScopeConfig;
  /** `memory` is discarded on restart; `sqlite` writes to one file. */
  store: StoreKind;
  /** Database file for the sqlite store. Ignored by the memory store. */
  sqlitePath: string;
  /** Where the sqlite store keeps config bodies. */
  documents: DocumentsKind;
  /** Directory for the `fs` document backend. */
  documentsPath: string;
  /** Seconds between orphan sweeps; `0` means never. */
  orphanSweepIntervalSeconds: number;
  /** An unreferenced document younger than this is a save in progress. */
  orphanMinAgeSeconds: number;
  /** Seed file, so a dev server can start with data. */
  seedPath: string | undefined;
  /** Serve the contract at /openapi.yaml and render it at /docs. */
  docs: boolean;
}

export type AuthConfig = InsecureAuthConfig | VerifiedAuthConfig;

/** Identity read from request headers, unverified. Loopback only. */
export interface InsecureAuthConfig {
  kind: "insecure";
}

/**
 * The verified schemes, of which at least one is present.
 *
 * More than one may be, because a deployment can face a front-end holding a
 * JWT and a service holding a ticket at the same time. They read different
 * headers, so they do not compete.
 */
export interface VerifiedAuthConfig {
  kind: "verified";
  jwt: JwtAuthConfig | undefined;
  ticket: TicketAuthConfig | undefined;
}

export interface JwtAuthConfig {
  issuer: string;
  audience: string[];
  /**
   * Derived from the key source rather than configured: a JWKS endpoint or a
   * public key means RS256, a shared secret means HS256. Deriving it means
   * "accept either" cannot be configured, which is the algorithm-confusion
   * attack.
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

export interface TicketAuthConfig {
  /** Request header the caller presents the ticket in. */
  header: string;
  /** Scheme prefix to strip from that header, when the caller sends one. */
  scheme: string | undefined;
  url: string;
  method: HttpMethod;
  present: TicketPresentation;
  /** A credential this server sends to the emitter, beyond the ticket itself. */
  serviceHeader: HeaderCredential | undefined;
  tenant: TicketTenantSource;
  claims: {
    userId: string;
    groups: string | undefined;
    displayName: string | undefined;
  };
  absentStatuses: number[];
  cacheSeconds: number;
  negativeCacheSeconds: number;
  requestTimeoutMs: number;
}

export type ScopeConfig = SeedScopeConfig | HttpScopeConfig;

/**
 * Membership from the seed file. Correct for a demo and for the tests; in a
 * deployment nobody maintains it, which is why the server says so at startup.
 */
export interface SeedScopeConfig {
  kind: "seed";
}

export interface HttpScopeConfig {
  kind: "http";
  url: string;
  method: HttpMethod;
  rolePath: string;
  /** Host role names mapped onto this package's. Empty means they match. */
  roleMap: Record<string, DashboardRole> | undefined;
  serviceHeader: HeaderCredential | undefined;
  absentStatuses: number[];
  cacheSeconds: number;
  negativeCacheSeconds: number;
  requestTimeoutMs: number;
}

export type HttpMethod = "GET" | "POST";

/** A header this server sends. The value is a credential; never log it. */
export interface HeaderCredential {
  name: string;
  value: string;
}

export const STORE_KINDS = ["memory", "sqlite"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

export const DOCUMENTS_KINDS = ["inline", "fs"] as const;
export type DocumentsKind = (typeof DOCUMENTS_KINDS)[number];

/** A relative path, so the default contains no hostname and no credential. */
export const DEFAULT_SQLITE_PATH = "./data/dashboards.db";
export const DEFAULT_DOCUMENTS_PATH = "./data/documents";

export const DEFAULT_ORPHAN_SWEEP_INTERVAL_SECONDS = 3_600;
/**
 * A day. A save holds its document unreferenced for milliseconds, so the
 * limit is set by how long a leftover is worth keeping as history, not by
 * the race it guards.
 */
export const DEFAULT_ORPHAN_MIN_AGE_SECONDS = 86_400;

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

/**
 * The shared secret, byte for byte.
 *
 * Trimming would change the key, since HMAC is computed over exactly these
 * bytes. Surrounding whitespace is usually an accident of how the value was
 * pasted or read from a file, but keeping it and removing it both produce a
 * server that starts and then rejects every token, so it is refused here
 * instead, where the message can say why.
 */
function readSecret(env: ConfigEnv): string | undefined {
  const raw = env.MIOT_DASHBOARD_JWT_SECRET;
  if (raw === undefined || raw.trim().length === 0) return undefined;
  if (raw !== raw.trim()) {
    throw new ConfigError(
      "MIOT_DASHBOARD_JWT_SECRET begins or ends with whitespace. It is used " +
        "as key material exactly as given, so this is either a stray newline " +
        "from how it was set, or part of the secret. Set it without the " +
        "surrounding whitespace.",
    );
  }
  return raw;
}

function readKeySource(env: ConfigEnv): JwtKeySource {
  const jwks = trimmed(env.MIOT_DASHBOARD_JWT_JWKS_URL);
  const publicKey = trimmed(env.MIOT_DASHBOARD_JWT_PUBLIC_KEY);
  const secret = readSecret(env);

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
        "Accepting two algorithms at once is what this server refuses to do: " +
        "the RS256 public key is published, and a verifier that also accepts " +
        "HS256 will take it as a shared secret.",
    );
  }

  if (jwks !== undefined) return { kind: "jwks", url: jwks };
  if (publicKey !== undefined) {
    return { kind: "publicKey", pem: unescapeNewlines(publicKey) };
  }
  return { kind: "secret", secret: secret as string };
}

function readSeconds(env: ConfigEnv, key: string, fallback: number): number {
  const raw = trimmed(env[key]);
  if (raw === undefined) return fallback;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0) {
    throw new ConfigError(
      `${key} must be a whole number of seconds, got "${raw}"`,
    );
  }
  return seconds;
}

function readClockTolerance(env: ConfigEnv): number {
  const raw = trimmed(env.MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE);
  if (raw === undefined) return DEFAULT_CLOCK_TOLERANCE_SECONDS;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 300) {
    throw new ConfigError(
      "MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE must be a whole number of seconds " +
        `between 0 and 300, got "${raw}". It extends how long an expired ` +
        "token is still accepted, so it is capped.",
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
    issuer: required(
      env,
      "MIOT_DASHBOARD_JWT_ISSUER",
      "the issuer whose tokens this server accepts, written exactly as the " +
        'tokens carry it (for Auth0, "https://<tenant>.auth0.com/").',
    ),
    audience,
    algorithm: key.kind === "secret" ? "HS256" : "RS256",
    key,
    claims: {
      tenantId: required(
        env,
        "MIOT_DASHBOARD_JWT_TENANT_CLAIM",
        "the claim carrying the tenant. No registered claim carries one and " +
          "every provider uses a different name, so there is no default: a " +
          "wrong default would put every caller in the same tenant.",
      ),
      userId: trimmed(env.MIOT_DASHBOARD_JWT_USER_CLAIM),
      groups: trimmed(env.MIOT_DASHBOARD_JWT_GROUPS_CLAIM),
      displayName: trimmed(env.MIOT_DASHBOARD_JWT_NAME_CLAIM),
    },
    clockToleranceSeconds: readClockTolerance(env),
  };
}

// ------------------------------------------- delegated to the host over HTTP ----

/**
 * Defaults for both host lookups. Sixty seconds is short enough that a
 * revoked membership or ticket stops working while someone is still looking
 * at the screen, and long enough that the host sees a fraction of this
 * server's traffic.
 */
const DEFAULT_LOOKUP_CACHE_SECONDS = 60;
const DEFAULT_NEGATIVE_CACHE_SECONDS = 30;
const DEFAULT_LOOKUP_TIMEOUT_MS = 5000;
const MAX_LOOKUP_CACHE_SECONDS = 3600;
const MAX_LOOKUP_TIMEOUT_MS = 30_000;

function readWholeNumber(
  env: ConfigEnv,
  key: string,
  fallback: number,
  max: number,
  units: string,
): number {
  const raw = trimmed(env[key]);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new ConfigError(
      `${key} must be a whole number of ${units} between 0 and ${max}, got "${raw}"`,
    );
  }
  return value;
}

function readMethod(env: ConfigEnv, key: string): HttpMethod {
  const raw = trimmed(env[key]);
  if (raw === undefined) return "GET";
  const method = raw.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    throw new ConfigError(`${key} must be GET or POST, got "${raw}"`);
  }
  return method;
}

function readStatuses(
  env: ConfigEnv,
  key: string,
  fallback: readonly number[],
): number[] {
  const raw = trimmed(env[key]);
  if (raw === undefined) return [...fallback];
  const statuses = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const status = Number(entry);
      if (!Number.isInteger(status) || status < 100 || status > 599) {
        throw new ConfigError(
          `${key} must be a comma-separated list of HTTP statuses, got "${entry}"`,
        );
      }
      return status;
    });
  if (statuses.length === 0) {
    throw new ConfigError(`${key} must name at least one status`);
  }
  return statuses;
}

/**
 * A header this server sends to the host, as a name and a value.
 *
 * Both or neither: a name with no value sends an empty credential, and a value
 * with no name is a credential that was configured and then not sent — the
 * kind of mistake that looks like it worked until the host starts enforcing.
 */
function readHeaderCredential(
  env: ConfigEnv,
  nameKey: string,
  valueKey: string,
): HeaderCredential | undefined {
  const name = trimmed(env[nameKey]);
  const value = env[valueKey];
  if (name === undefined && (value === undefined || value.length === 0)) {
    return undefined;
  }
  if (name === undefined || value === undefined || value.length === 0) {
    throw new ConfigError(
      `${nameKey} and ${valueKey} must be set together; one without the ` +
        "other either sends an empty credential or configures one that is " +
        "never sent",
    );
  }
  return { name, value };
}

/** `SiteManager=Coordinator,SiteConsumer=Consumer` into a lookup. */
function readRoleMap(
  env: ConfigEnv,
  key: string,
): Record<string, DashboardRole> | undefined {
  const raw = trimmed(env[key]);
  if (raw === undefined) return undefined;

  const map: Record<string, DashboardRole> = Object.create(null) as Record<
    string,
    DashboardRole
  >;
  for (const pair of raw.split(",")) {
    const entry = pair.trim();
    if (entry.length === 0) continue;
    const separator = entry.indexOf("=");
    if (separator < 1) {
      throw new ConfigError(
        `${key} must be a comma-separated list of <host role>=<role>, got "${entry}"`,
      );
    }
    const from = entry.slice(0, separator).trim();
    const to = entry.slice(separator + 1).trim();
    if (!(DASHBOARD_ROLES as readonly string[]).includes(to)) {
      throw new ConfigError(
        `${key} maps "${from}" to "${to}", which is not one of ` +
          `${DASHBOARD_ROLES.join(", ")}`,
      );
    }
    map[from] = to as DashboardRole;
  }
  if (Object.keys(map).length === 0) {
    throw new ConfigError(`${key} must map at least one role`);
  }
  return map;
}

/** Every variable that only means anything to the ticket resolver. */
const TICKET_ENV_KEYS = [
  "MIOT_DASHBOARD_TICKET_HEADER",
  "MIOT_DASHBOARD_TICKET_SCHEME",
  "MIOT_DASHBOARD_TICKET_VALIDATE_URL",
  "MIOT_DASHBOARD_TICKET_VALIDATE_METHOD",
  "MIOT_DASHBOARD_TICKET_PRESENT",
  "MIOT_DASHBOARD_TICKET_PRESENT_NAME",
  "MIOT_DASHBOARD_TICKET_PRESENT_VALUE",
  "MIOT_DASHBOARD_TICKET_SERVICE_HEADER",
  "MIOT_DASHBOARD_TICKET_SERVICE_VALUE",
  "MIOT_DASHBOARD_TICKET_TENANT",
  "MIOT_DASHBOARD_TICKET_TENANT_PATH",
  "MIOT_DASHBOARD_TICKET_USER_PATH",
  "MIOT_DASHBOARD_TICKET_GROUPS_PATH",
  "MIOT_DASHBOARD_TICKET_NAME_PATH",
  "MIOT_DASHBOARD_TICKET_INVALID_STATUS",
  "MIOT_DASHBOARD_TICKET_CACHE",
  "MIOT_DASHBOARD_TICKET_NEGATIVE_CACHE",
  "MIOT_DASHBOARD_TICKET_TIMEOUT",
] as const;

function readTicketPresentation(env: ConfigEnv): TicketPresentation {
  const kind = (
    trimmed(env.MIOT_DASHBOARD_TICKET_PRESENT) ?? "header"
  ).toLowerCase();
  const name = trimmed(env.MIOT_DASHBOARD_TICKET_PRESENT_NAME);

  if (kind === "body") return { kind: "body" };
  if (kind === "query") {
    if (name === undefined) {
      throw new ConfigError(
        "MIOT_DASHBOARD_TICKET_PRESENT_NAME is required when " +
          'MIOT_DASHBOARD_TICKET_PRESENT="query": it names the query parameter',
      );
    }
    return { kind: "query", name };
  }
  if (kind !== "header") {
    throw new ConfigError(
      "MIOT_DASHBOARD_TICKET_PRESENT must be header, query or body, got " +
        `"${kind}"`,
    );
  }

  const value = trimmed(env.MIOT_DASHBOARD_TICKET_PRESENT_VALUE);
  if (name === undefined || value === undefined) {
    throw new ConfigError(
      "MIOT_DASHBOARD_TICKET_PRESENT_NAME and " +
        "MIOT_DASHBOARD_TICKET_PRESENT_VALUE are required when the ticket is " +
        "presented in a header. The value is a template over {ticket} and " +
        "{ticketBase64}, so an emitter wanting basic authentication takes " +
        '"Basic {ticketBase64}".',
    );
  }
  return { kind: "header", name, value };
}

function readTicketTenant(env: ConfigEnv): TicketTenantSource {
  const fixed = trimmed(env.MIOT_DASHBOARD_TICKET_TENANT);
  const path = trimmed(env.MIOT_DASHBOARD_TICKET_TENANT_PATH);

  if (fixed !== undefined && path !== undefined) {
    throw new ConfigError(
      "Set exactly one of MIOT_DASHBOARD_TICKET_TENANT and " +
        "MIOT_DASHBOARD_TICKET_TENANT_PATH. The first names the single " +
        "tenant this emitter serves; the second reads it from the emitter's " +
        "answer.",
    );
  }
  if (fixed !== undefined) return { kind: "fixed", tenantId: fixed };
  if (path !== undefined) return { kind: "path", path };
  throw new ConfigError(
    "Ticket authentication needs a tenant. Set MIOT_DASHBOARD_TICKET_TENANT " +
      "when the emitter serves one tenant, or MIOT_DASHBOARD_TICKET_TENANT_PATH " +
      "to read it from the validation response. There is no default: without " +
      "one, every ticket holder would land in the same tenant.",
  );
}

function readTicketAuth(env: ConfigEnv): TicketAuthConfig {
  return {
    header: required(
      env,
      "MIOT_DASHBOARD_TICKET_HEADER",
      "the request header callers present the ticket in. No standard header " +
        "carries one, so there is no default.",
    ),
    scheme: trimmed(env.MIOT_DASHBOARD_TICKET_SCHEME),
    url: required(
      env,
      "MIOT_DASHBOARD_TICKET_VALIDATE_URL",
      "the emitter's endpoint for checking a ticket. A ticket carries no " +
        "proof of its own, so only the emitter can say whether it is valid.",
    ),
    method: readMethod(env, "MIOT_DASHBOARD_TICKET_VALIDATE_METHOD"),
    present: readTicketPresentation(env),
    serviceHeader: readHeaderCredential(
      env,
      "MIOT_DASHBOARD_TICKET_SERVICE_HEADER",
      "MIOT_DASHBOARD_TICKET_SERVICE_VALUE",
    ),
    tenant: readTicketTenant(env),
    claims: {
      userId: required(
        env,
        "MIOT_DASHBOARD_TICKET_USER_PATH",
        "where the user id sits in the emitter's answer, as a dotted path " +
          'into the JSON it returns, such as "entry.id".',
      ),
      groups: trimmed(env.MIOT_DASHBOARD_TICKET_GROUPS_PATH),
      displayName: trimmed(env.MIOT_DASHBOARD_TICKET_NAME_PATH),
    },
    absentStatuses: readStatuses(
      env,
      "MIOT_DASHBOARD_TICKET_INVALID_STATUS",
      [401, 404],
    ),
    cacheSeconds: readWholeNumber(
      env,
      "MIOT_DASHBOARD_TICKET_CACHE",
      DEFAULT_LOOKUP_CACHE_SECONDS,
      MAX_LOOKUP_CACHE_SECONDS,
      "seconds",
    ),
    negativeCacheSeconds: readWholeNumber(
      env,
      "MIOT_DASHBOARD_TICKET_NEGATIVE_CACHE",
      DEFAULT_NEGATIVE_CACHE_SECONDS,
      MAX_LOOKUP_CACHE_SECONDS,
      "seconds",
    ),
    requestTimeoutMs: readWholeNumber(
      env,
      "MIOT_DASHBOARD_TICKET_TIMEOUT",
      DEFAULT_LOOKUP_TIMEOUT_MS,
      MAX_LOOKUP_TIMEOUT_MS,
      "milliseconds",
    ),
  };
}

function readScopes(env: ConfigEnv): ScopeConfig {
  const url = trimmed(env.MIOT_DASHBOARD_SCOPES_URL);
  if (url === undefined) return { kind: "seed" };

  return {
    kind: "http",
    url,
    method: readMethod(env, "MIOT_DASHBOARD_SCOPES_METHOD"),
    rolePath: trimmed(env.MIOT_DASHBOARD_SCOPES_ROLE_PATH) ?? "role",
    roleMap: readRoleMap(env, "MIOT_DASHBOARD_SCOPES_ROLE_MAP"),
    serviceHeader: readHeaderCredential(
      env,
      "MIOT_DASHBOARD_SCOPES_SERVICE_HEADER",
      "MIOT_DASHBOARD_SCOPES_SERVICE_VALUE",
    ),
    absentStatuses: readStatuses(
      env,
      "MIOT_DASHBOARD_SCOPES_ABSENT_STATUS",
      [404],
    ),
    cacheSeconds: readWholeNumber(
      env,
      "MIOT_DASHBOARD_SCOPES_CACHE",
      DEFAULT_LOOKUP_CACHE_SECONDS,
      MAX_LOOKUP_CACHE_SECONDS,
      "seconds",
    ),
    negativeCacheSeconds: readWholeNumber(
      env,
      "MIOT_DASHBOARD_SCOPES_NEGATIVE_CACHE",
      DEFAULT_NEGATIVE_CACHE_SECONDS,
      MAX_LOOKUP_CACHE_SECONDS,
      "seconds",
    ),
    requestTimeoutMs: readWholeNumber(
      env,
      "MIOT_DASHBOARD_SCOPES_TIMEOUT",
      DEFAULT_LOOKUP_TIMEOUT_MS,
      MAX_LOOKUP_TIMEOUT_MS,
      "milliseconds",
    ),
  };
}

/**
 * Pick the identity provider, refusing anything unsafe rather than warning
 * about it. The insecure resolver lets any caller claim any user in any
 * tenant, so it is the switch this function guards hardest.
 */
function readAuth(env: ConfigEnv, host: string): AuthConfig {
  const insecure = readBoolean(env.MIOT_DASHBOARD_INSECURE_AUTH);
  const jwtKeys = JWT_ENV_KEYS.filter((key) => trimmed(env[key]) !== undefined);
  const ticketKeys = TICKET_ENV_KEYS.filter(
    (key) => trimmed(env[key]) !== undefined,
  );
  const verifiedKeys = [...jwtKeys, ...ticketKeys];

  if (insecure && verifiedKeys.length > 0) {
    throw new ConfigError(
      "Two identity providers are configured: MIOT_DASHBOARD_INSECURE_AUTH " +
        `is on and ${verifiedKeys.join(", ")} is set. Unset one: a server ` +
        "that preferred either would verify credentials in one environment " +
        "and trust headers in another.",
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

  // Both may be configured. A JWT arrives in Authorization and a ticket in a
  // header the operator names, so the two are read from different places and
  // a request carrying neither is anonymous either way.
  if (verifiedKeys.length > 0) {
    return {
      kind: "verified",
      jwt: jwtKeys.length > 0 ? readJwtAuth(env) : undefined,
      ticket: ticketKeys.length > 0 ? readTicketAuth(env) : undefined,
    };
  }

  throw new ConfigError(
    "No identity provider is configured. Either set MIOT_DASHBOARD_JWT_ISSUER, " +
      "MIOT_DASHBOARD_JWT_AUDIENCE, MIOT_DASHBOARD_JWT_TENANT_CLAIM and one key " +
      "source (MIOT_DASHBOARD_JWT_JWKS_URL, MIOT_DASHBOARD_JWT_PUBLIC_KEY or " +
      "MIOT_DASHBOARD_JWT_SECRET) to verify bearer tokens; or set " +
      "MIOT_DASHBOARD_TICKET_HEADER and MIOT_DASHBOARD_TICKET_VALIDATE_URL to " +
      "validate tickets against their emitter; or opt into " +
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

  const documents = env.MIOT_DASHBOARD_DOCUMENTS ?? "inline";
  if (!(DOCUMENTS_KINDS as readonly string[]).includes(documents)) {
    throw new ConfigError(
      `MIOT_DASHBOARD_DOCUMENTS="${documents}" is not supported. Choose one of: ` +
        `${DOCUMENTS_KINDS.join(", ")}. Buckets land with P2b-3.`,
    );
  }
  if (store === "memory" && env.MIOT_DASHBOARD_DOCUMENTS !== undefined) {
    // Refused rather than ignored: a setting that does nothing would be
    // taken for one that worked.
    throw new ConfigError(
      "MIOT_DASHBOARD_DOCUMENTS has no effect with the memory store, which " +
        "keeps nothing. Set MIOT_DASHBOARD_STORE=sqlite as well.",
    );
  }

  return {
    port: readPort(env),
    host,
    basePath: env.MIOT_DASHBOARD_BASE_PATH ?? "",
    auth,
    scopes: readScopes(env),
    store: store as StoreKind,
    sqlitePath: env.MIOT_DASHBOARD_SQLITE_PATH ?? DEFAULT_SQLITE_PATH,
    documents: documents as DocumentsKind,
    documentsPath: env.MIOT_DASHBOARD_DOCUMENTS_PATH ?? DEFAULT_DOCUMENTS_PATH,
    orphanSweepIntervalSeconds: readSeconds(
      env,
      "MIOT_DASHBOARD_ORPHAN_SWEEP_INTERVAL",
      DEFAULT_ORPHAN_SWEEP_INTERVAL_SECONDS,
    ),
    orphanMinAgeSeconds: readSeconds(
      env,
      "MIOT_DASHBOARD_ORPHAN_MIN_AGE",
      DEFAULT_ORPHAN_MIN_AGE_SECONDS,
    ),
    seedPath: env.MIOT_DASHBOARD_SEED,
    docs: readBooleanUnlessDisabled(env.MIOT_DASHBOARD_DOCS),
  };
}
