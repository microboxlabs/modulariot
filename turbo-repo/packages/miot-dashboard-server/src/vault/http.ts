/**
 * A read-only vault that asks the host for applied auth.
 *
 * For a deployment whose credentials belong to another system. Inside
 * modulariot that is the credentials component: it already stores the
 * secret, already runs an OAuth2 grant where the credential needs one, and
 * already reduces the result to headers and query parameters. This asks it
 * for that result, so the secret never leaves it.
 *
 * The same shared key as the trusted-proxy assertion, in the other
 * direction. The host is asserting to this server rather than the reverse,
 * and one key covers both because both mean "these two processes are
 * deployed together".
 *
 * A credential that does not exist is 404 and reads as null. Anything else
 * throws, including 401 and 403: from this side those mean *our* key was
 * refused, which is a misconfiguration to be seen and not a quiet "no
 * credential".
 */

import { MIN_PROXY_KEY_LENGTH } from "../identity/proxy";
import {
  EndpointError,
  fetchJson,
  fillTemplate,
  placeholderProblem,
  secureUrlProblem,
} from "../net/endpoint";
import type {
  CredentialsVault,
  DataSourceCredential,
} from "../seams/credentials";

const PLACEHOLDERS = ["tenantId", "credentialRef"] as const;
const DEFAULT_TIMEOUT_MS = 5000;
/**
 * How long applied auth is reused when the host states no expiry, and the
 * ceiling on reuse when it states a distant one. Short, because this caches
 * the authority to act rather than a fact about it: a credential revoked at
 * the host keeps working for at most this long.
 */
const DEFAULT_MAX_CACHE_SECONDS = 60;
const DEFAULT_MAX_ENTRIES = 500;

export interface HttpCredentialsVaultOptions {
  /**
   * The host's endpoint. `{tenantId}` and `{credentialRef}` fill in, both
   * percent-encoded.
   */
  url: string;
  /**
   * The shared key, sent as `x-miot-proxy-key`. At least
   * `MIN_PROXY_KEY_LENGTH` characters; the same value the host checks.
   */
  proxyKey: string;
  /** Header the key is sent in. Defaults to `x-miot-proxy-key`. */
  keyHeader?: string;
  requestTimeoutMs?: number;
  maxCacheSeconds?: number;
  maxCacheEntries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface Entry {
  value: DataSourceCredential | null;
  expiresAt: number;
}

/**
 * The wire shape is `DataSourceCredential` itself. Validated rather than
 * cast: a host that answered something else would otherwise produce a
 * request with `undefined` in a header.
 */
function parseCredential(body: unknown): DataSourceCredential {
  if (typeof body !== "object" || body === null) {
    throw new EndpointError("The credential endpoint answered a non-object");
  }
  const raw = body as Record<string, unknown>;

  if (raw.kind === "NONE") return { kind: "NONE" };

  if (raw.kind === "HTTP_AUTH") {
    const expiresAt = raw.expiresAt;
    return {
      kind: "HTTP_AUTH",
      headers: stringMap(raw.headers, "headers"),
      queryParams: stringMap(raw.queryParams, "queryParams"),
      ...(typeof expiresAt === "string" ? { expiresAt } : {}),
    };
  }

  if (raw.kind === "SERVICE_ACCOUNT") {
    return {
      kind: "SERVICE_ACCOUNT",
      projectId: requireString(raw, "projectId"),
      clientEmail: requireString(raw, "clientEmail"),
      privateKey: requireString(raw, "privateKey"),
    };
  }

  throw new EndpointError(
    "The credential endpoint answered an unrecognized kind",
  );
}

function requireString(raw: Record<string, unknown>, field: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.length === 0) {
    // The field name, never the value: the value is the secret.
    throw new EndpointError(
      `The credential endpoint answered without "${field}"`,
    );
  }
  return value;
}

function stringMap(value: unknown, what: string): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new EndpointError(
      `The credential endpoint answered a "${what}" that is not an object`,
    );
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new EndpointError(
        `The credential endpoint answered a non-string in "${what}"`,
      );
    }
    out[key] = entry;
  }
  return out;
}

export function createHttpCredentialsVault(
  options: HttpCredentialsVaultOptions,
): CredentialsVault {
  const what = "The credential endpoint URL";

  // Presence, which `placeholderProblem` does not check: it asks only that a
  // placeholder is not in the host or port. A URL without `{tenantId}`
  // parses, passes that, and then addresses the same credential whichever
  // tenant asked.
  for (const name of PLACEHOLDERS) {
    if (!options.url.includes(`{${name}}`)) {
      throw new EndpointError(
        `${what} must contain {${name}}. Without it every tenant resolves ` +
          "through the same address.",
      );
    }
  }

  const problem =
    placeholderProblem(options.url, PLACEHOLDERS, what) ??
    secureUrlProblem(
      fillTemplate(options.url, { tenantId: "t", credentialRef: "c" }),
      what,
    );
  if (problem !== null) throw new EndpointError(problem);

  if (options.proxyKey.length < MIN_PROXY_KEY_LENGTH) {
    throw new EndpointError(
      `The credential endpoint key must be at least ${MIN_PROXY_KEY_LENGTH} ` +
        "characters. It is what lets this server ask for any credential in " +
        "any tenant.",
    );
  }

  const now = options.now ?? Date.now;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const keyHeader = options.keyHeader ?? "x-miot-proxy-key";
  const maxCacheMs =
    (options.maxCacheSeconds ?? DEFAULT_MAX_CACHE_SECONDS) * 1000;
  const maxEntries = options.maxCacheEntries ?? DEFAULT_MAX_ENTRIES;

  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<DataSourceCredential | null>>();

  /**
   * How long this answer may be reused: the host's own expiry, but never
   * longer than the ceiling, and never at all for one already past.
   */
  function cacheUntil(value: DataSourceCredential | null): number {
    const ceiling = now() + maxCacheMs;
    if (value === null || value.kind !== "HTTP_AUTH") return ceiling;
    if (value.expiresAt === undefined) return ceiling;

    const stated = Date.parse(value.expiresAt);
    if (Number.isNaN(stated)) return ceiling;
    return Math.min(stated, ceiling);
  }

  function remember(key: string, value: DataSourceCredential | null): void {
    entries.set(key, { value, expiresAt: cacheUntil(value) });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done === true) break;
      entries.delete(oldest.value);
    }
  }

  async function load(
    tenantId: string,
    credentialRef: string,
  ): Promise<DataSourceCredential | null> {
    // `fillTemplate` percent-encodes what it substitutes, so these go in raw.
    const url = new URL(fillTemplate(options.url, { tenantId, credentialRef }));

    const outcome = await fetchJson({
      url,
      method: "GET",
      headers: { [keyHeader]: options.proxyKey },
      timeoutMs,
      // 404 only. 401 and 403 are our own key being refused, and fetchJson
      // raises for them, which is what makes that visible.
      absentStatuses: [404],
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

    return outcome.kind === "absent" ? null : parseCredential(outcome.body);
  }

  return {
    async resolve(tenantId, credentialRef) {
      const key = `${tenantId}\u0000${credentialRef}`;

      const cached = entries.get(key);
      if (cached !== undefined && cached.expiresAt > now()) {
        return cached.value;
      }
      entries.delete(key);

      // One call per key while it is outstanding: a page that opens six
      // widgets on one datasource asks the host once.
      const pending = inFlight.get(key);
      if (pending !== undefined) return pending;

      const call = load(tenantId, credentialRef)
        .then((value) => {
          remember(key, value);
          return value;
        })
        .finally(() => {
          // A failure is never cached: caching one would turn a moment of
          // host downtime into a fixed period of refusing every query.
          inFlight.delete(key);
        });

      inFlight.set(key, call);
      return call;
    },
  };
}
