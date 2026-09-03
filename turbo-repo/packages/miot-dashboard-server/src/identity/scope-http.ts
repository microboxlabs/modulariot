/**
 * Scope membership answered by the host's own service.
 *
 * `IdentityResolver` says who the caller is; this says what they may do in the
 * scope a URL names. The two halves are deliberately separate because they
 * have different owners: identity comes from the token issuer, membership from
 * whatever system already knows who belongs to what — Alfresco sites, a
 * directory group, a table in the host's database.
 *
 * The package keeps per-dashboard permission assignments in its own store and
 * delegates only scope membership, because a dashboard is a row here with
 * nothing in the host to hang an access list on, while a scope is the host's
 * concept and duplicating its membership would leave two answers to maintain.
 *
 * A failed lookup is not a denial. If the host's service is unreachable this
 * throws, and the request becomes a 500. Returning "not a member" instead
 * would present an outage as a working server that has locked everybody out.
 */

import { isDashboardRole, type DashboardRole } from "../access/roles";
import {
  EndpointError,
  fetchJson,
  fillTemplate,
  readPath,
  secureUrlProblem,
} from "../net/endpoint";
import { createLookupCache } from "../net/lookup-cache";
import type { ScopeAuthority } from "../seams/identity";

export interface HttpScopeAuthorityOptions {
  /**
   * The membership endpoint, with `{tenantId}`, `{scopeId}` and `{userId}`
   * filled in per request. Values are URL-encoded.
   *
   * For Alfresco sites this is the person-membership resource, which answers
   * 404 for a non-member:
   * `…/public/alfresco/versions/1/people/{userId}/sites/{scopeId}`
   */
  url: string;
  /** POST sends the identity as a JSON body instead of a path. Default GET. */
  method?: "GET" | "POST";
  /**
   * Sent with every lookup. This is where the credential goes that lets this
   * server ask about other people's memberships.
   */
  headers?: Readonly<Record<string, string>>;
  /** Dotted path to the role in the response. Default `role`. */
  rolePath?: string;
  /**
   * The host's role names mapped onto this package's. Without it the response
   * must already carry a `DashboardRole`.
   *
   * Alfresco's site roles map one to one: SiteManager → Coordinator,
   * SiteCollaborator → Editor, SiteContributor → Contributor,
   * SiteConsumer → Consumer.
   */
  roleMap?: Readonly<Record<string, DashboardRole>>;
  /** Statuses meaning "not a member". Default `[404]`. */
  absentStatuses?: readonly number[];
  /** How long a membership is reused. Bounds how long a revocation takes. */
  cacheSeconds?: number;
  /** How long a non-membership is reused. Bounds how long a grant takes. */
  negativeCacheSeconds?: number;
  maxCacheEntries?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /**
   * Called when a lookup succeeded but its answer could not be used — an
   * unmapped role name, or a role path that matched nothing. A plain
   * non-member is not reported here: that is a normal refusal, already
   * audited, and logging it would write a line per unauthorized request.
   */
  onReject?: (reason: string) => void;
}

const DEFAULT_ROLE_PATH = "role";
const DEFAULT_ABSENT = [404] as const;
const DEFAULT_CACHE_SECONDS = 60;
const DEFAULT_NEGATIVE_CACHE_SECONDS = 30;
const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TIMEOUT_MS = 5000;

interface Membership {
  tenantId: string;
  userId: string;
  scopeId: string;
  groups: string[];
}

/**
 * The lookup key. It carries the groups as well as the ids because a host may
 * answer from them, and because a token issued with different groups should
 * not read an answer computed for the old ones.
 */
function cacheKey(question: Membership): string {
  return JSON.stringify([
    question.tenantId,
    question.userId,
    question.scopeId,
    [...question.groups].sort(),
  ]);
}

export function createHttpScopeAuthority(
  options: HttpScopeAuthorityOptions,
): ScopeAuthority {
  const problem = secureUrlProblem(
    // Placeholders are not valid URL characters everywhere, so the template is
    // checked with them filled by a harmless value.
    fillTemplate(options.url, { tenantId: "t", scopeId: "s", userId: "u" }),
    "The scope membership URL",
  );
  if (problem !== null) throw new EndpointError(problem);

  const method = options.method ?? "GET";
  const rolePath = options.rolePath ?? DEFAULT_ROLE_PATH;
  const absentStatuses = options.absentStatuses ?? DEFAULT_ABSENT;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = { ...(options.headers ?? {}) };

  function roleFrom(body: unknown): DashboardRole | null {
    const raw = readPath(body, rolePath);
    if (typeof raw !== "string" || raw.length === 0) {
      // Distinguished from a 404 on purpose: the host said this person has a
      // membership and then did not say what it is, which is usually a wrong
      // `rolePath` rather than a real denial.
      options.onReject?.(
        `the membership service answered without a usable "${rolePath}"`,
      );
      return null;
    }
    if (options.roleMap !== undefined) {
      const mapped = Object.prototype.hasOwnProperty.call(options.roleMap, raw)
        ? options.roleMap[raw]
        : undefined;
      if (mapped === undefined) {
        options.onReject?.(
          `the membership service returned the role "${raw}", which is not ` +
            "in the configured role mapping",
        );
        return null;
      }
      return mapped;
    }
    if (!isDashboardRole(raw)) {
      options.onReject?.(
        `the membership service returned the role "${raw}", which is not one ` +
          "of Consumer, Contributor, Editor, Coordinator. Configure a role " +
          "mapping if the host uses its own names.",
      );
      return null;
    }
    return raw;
  }

  const lookup = createLookupCache<Membership, DashboardRole>({
    ttlMs: (options.cacheSeconds ?? DEFAULT_CACHE_SECONDS) * 1000,
    negativeTtlMs:
      (options.negativeCacheSeconds ?? DEFAULT_NEGATIVE_CACHE_SECONDS) * 1000,
    maxEntries: options.maxCacheEntries ?? DEFAULT_MAX_ENTRIES,
    ...(options.now ? { now: options.now } : {}),
    load: async ({ tenantId, userId, scopeId, groups }) => {
      const outcome = await fetchJson({
        url: new URL(fillTemplate(options.url, { tenantId, scopeId, userId })),
        method,
        headers,
        ...(method === "POST"
          ? { body: { tenantId, userId, groups, scopeId } }
          : {}),
        timeoutMs,
        absentStatuses,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });

      return outcome.kind === "absent" ? null : roleFrom(outcome.body);
    },
  });

  return {
    resolveScopeRole(identity, scopeId) {
      const question: Membership = {
        tenantId: identity.tenantId,
        userId: identity.userId,
        scopeId,
        groups: identity.groups ?? [],
      };
      return lookup(cacheKey(question), question);
    },
  };
}
