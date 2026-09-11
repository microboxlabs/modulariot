/**
 * Tenant entitlement answered by the host's own service.
 *
 * The request names a tenant; this says whether the caller may act in it. It
 * is the seam that lets one credential serve a person who works in several
 * tenants, without minting a token per tenant and without making them
 * re-authenticate to switch.
 *
 * It is a lookup rather than a claim on purpose. Adding someone to a tenant
 * has to take effect while they are looking at the screen, and a claim can
 * only change when the token does.
 *
 * A failed lookup is not a denial. If the host's service is unreachable this
 * throws and the request becomes a 500, for the same reason the scope lookup
 * does: answering "not entitled" during an outage presents a working server
 * that has locked everybody out.
 */

import {
  EndpointError,
  fetchJson,
  fillTemplate,
  placeholderProblem,
  readPath,
  secureUrlProblem,
} from "../net/endpoint";
import { createLookupCache } from "../net/lookup-cache";
import type { DashboardPrincipal, TenantAuthority } from "../seams/identity";

export interface HttpTenantAuthorityOptions {
  /**
   * The entitlement endpoint, with `{tenantId}` and `{userId}` filled in per
   * request. Values are URL-encoded.
   *
   * The usual shape answers 404 for "not entitled":
   * `https://host.internal/people/{userId}/tenants/{tenantId}`
   */
  url: string;
  /** POST sends the principal as a JSON body instead of a path. Default GET. */
  method?: "GET" | "POST";
  /**
   * Sent with every lookup. This is where the credential goes that lets this
   * server ask about other people's entitlements.
   */
  headers?: Readonly<Record<string, string>>;
  /**
   * Statuses meaning "not entitled to this tenant". Default `[404]`.
   *
   * 401 is deliberately not in the default: with a service credential
   * configured it means *this server's* credential was refused, which is a
   * misconfiguration to surface, not a caller to turn away.
   */
  absentStatuses?: readonly number[];
  /**
   * Dotted path to a boolean in the response that can still say no.
   *
   * Without it, any non-absent answer means yes, which is what a service that
   * signals entitlement by status code wants. With it, a 200 carrying `false`
   * is a refusal — for a host that answers 200 either way.
   */
  entitledPath?: string;
  /** How long a yes is reused. Bounds how long a revocation takes. */
  cacheSeconds?: number;
  /** How long a no is reused. Bounds how long a new grant takes. */
  negativeCacheSeconds?: number;
  maxCacheEntries?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /**
   * Called when a lookup succeeded but its answer could not be used — an
   * `entitledPath` that matched nothing. A plain "not entitled" is not
   * reported here: that is a normal refusal, already audited, and logging it
   * would write a line per unauthorized request.
   */
  onReject?: (reason: string) => void;
}

const PLACEHOLDERS = ["tenantId", "userId"] as const;

const DEFAULT_ABSENT = [404] as const;
const DEFAULT_CACHE_SECONDS = 60;
const DEFAULT_NEGATIVE_CACHE_SECONDS = 30;
const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TIMEOUT_MS = 5000;

interface Entitlement {
  userId: string;
  tenantId: string;
  groups: string[];
}

/**
 * The lookup key. It carries the groups as well as the ids because a host may
 * answer from them, and because a token issued with different groups should
 * not read an answer computed for the old ones.
 */
function cacheKey(question: Entitlement): string {
  return JSON.stringify([
    question.userId,
    question.tenantId,
    [...question.groups].sort(),
  ]);
}

/**
 * A GET URL that does not vary by both ids asks the same question for every
 * caller, and the first yes would be cached as a yes for everyone. POST is
 * exempt: it carries both in the body.
 */
function missingPlaceholder(url: string, method: string): string | null {
  if (method !== "GET") return null;
  const missing = ["{userId}", "{tenantId}"].filter(
    (name) => !url.includes(name),
  );
  return missing.length === 0
    ? null
    : `The tenant entitlement URL is a GET and does not contain ` +
        `${missing.join(" or ")}. It would ask the same question for every ` +
        "caller, and one yes would entitle everyone. Put both placeholders " +
        "in the URL, or use POST to send them in the body.";
}

export function createHttpTenantAuthority(
  options: HttpTenantAuthorityOptions,
): TenantAuthority {
  const method = options.method ?? "GET";

  const what = "The tenant entitlement URL";
  const problem =
    placeholderProblem(options.url, PLACEHOLDERS, what) ??
    secureUrlProblem(
      // Placeholders are not valid URL characters everywhere, so the template
      // is checked with them filled by a harmless value.
      fillTemplate(options.url, { tenantId: "t", userId: "u" }),
      what,
    ) ??
    missingPlaceholder(options.url, method);
  if (problem !== null) throw new EndpointError(problem);

  const absentStatuses = options.absentStatuses ?? DEFAULT_ABSENT;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = { ...(options.headers ?? {}) };

  function entitledFrom(body: unknown): true | null {
    if (options.entitledPath === undefined) return true;
    const raw = readPath(body, options.entitledPath);
    if (typeof raw !== "boolean") {
      // Distinguished from a 404 on purpose: the host answered and then did
      // not say yes or no, which is usually a wrong `entitledPath` rather
      // than a real refusal.
      options.onReject?.(
        `the tenant service answered without a usable "${options.entitledPath}"`,
      );
      return null;
    }
    return raw ? true : null;
  }

  const lookup = createLookupCache<Entitlement, true>({
    ttlMs: (options.cacheSeconds ?? DEFAULT_CACHE_SECONDS) * 1000,
    negativeTtlMs:
      (options.negativeCacheSeconds ?? DEFAULT_NEGATIVE_CACHE_SECONDS) * 1000,
    maxEntries: options.maxCacheEntries ?? DEFAULT_MAX_ENTRIES,
    ...(options.now ? { now: options.now } : {}),
    load: async ({ userId, tenantId, groups }) => {
      const outcome = await fetchJson({
        url: new URL(fillTemplate(options.url, { tenantId, userId })),
        method,
        headers,
        ...(method === "POST" ? { body: { userId, tenantId, groups } } : {}),
        timeoutMs,
        absentStatuses,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });

      return outcome.kind === "absent" ? null : entitledFrom(outcome.body);
    },
  });

  return {
    async mayActAs(
      principal: DashboardPrincipal,
      tenantId: string,
    ): Promise<boolean> {
      const question: Entitlement = {
        userId: principal.userId,
        tenantId,
        groups: principal.groups ?? [],
      };
      return (await lookup(cacheKey(question), question)) === true;
    },
  };
}
