/**
 * Ticket authentication: an opaque credential validated by whoever issued it.
 *
 * A JWT carries its own proof, so this server can check it alone. A ticket
 * carries none — it is a reference, and only the system that minted it knows
 * whether it is still good. So every field of the resulting identity comes
 * from the emitter's answer, and a ticket this server cannot validate is a
 * ticket it refuses.
 *
 * Nothing here is vendor-specific. The header the caller uses, how the ticket
 * is presented to the emitter, and where the identity sits in the response are
 * all configuration, because no standard covers any of it.
 *
 * As with the JWT resolver, "the emitter says no" and "the emitter did not
 * answer" are different. The first is a 401. The second throws, because
 * answering 401 while the emitter is down rejects every valid ticket for as
 * long as the outage lasts.
 */

import { FULL_CAPABILITIES } from "../access/roles";
import {
  EndpointError,
  fetchJson,
  fillHeaderTemplate,
  fillTemplate,
  readGroupsAt,
  readIdentifierAt,
  secureUrlProblem,
} from "../net/endpoint";
import { createLookupCache } from "../net/lookup-cache";
import type {
  DashboardIdentity,
  DashboardPrincipalKind,
  IdentityResolver,
} from "../seams/identity";

/** How the ticket reaches the emitter's validation endpoint. */
export type TicketPresentation =
  /**
   * A header whose value is a template over `{ticket}` and `{ticketBase64}`.
   * Alfresco wants `Authorization: Basic {ticketBase64}`.
   */
  | { kind: "header"; name: string; value: string }
  /** A query parameter, as `?<name>=<ticket>`. */
  | { kind: "query"; name: string }
  /** A POST body of `{"ticket": "…"}`. */
  | { kind: "body" };

export interface TicketClaimPaths {
  /** Dotted path to the user id in the validation response. */
  userId: string;
  /** Dotted path to group or role ids. Matched against assignment authorities. */
  groups?: string;
  displayName?: string;
}

/**
 * Where the tenant comes from. There is no third option and no default: a
 * ticket resolver that cannot say which tenant a caller is in would put every
 * caller in the same one.
 */
export type TicketTenantSource =
  /** The emitter serves one tenant, named here. */
  | { kind: "fixed"; tenantId: string }
  /** The emitter says which tenant, at this path in the response. */
  | { kind: "path"; path: string };

export interface TicketIdentityOptions {
  /**
   * The request header the caller presents the ticket in. Required: there is
   * no standard header for this, so a default would be a guess that silently
   * ignores the real one.
   */
  header: string;
  /**
   * A scheme prefix to strip from that header, if the caller sends one — for
   * a header holding `Bearer <ticket>`, set this to `Bearer`.
   */
  scheme?: string;
  /** The emitter's validation endpoint. `{ticket}` and `{ticketBase64}` fill in. */
  url: string;
  method?: "GET" | "POST";
  present: TicketPresentation;
  /** Sent with every validation, for an emitter that also wants a service credential. */
  headers?: Readonly<Record<string, string>>;
  tenant: TicketTenantSource;
  claims: TicketClaimPaths;
  /**
   * Statuses meaning "this ticket is not valid". Default `[401, 404]`, which
   * is what an emitter answers for an expired or unknown ticket.
   *
   * 401 is in the default here, unlike the membership lookup, because the
   * ticket *is* the credential being presented. Where a service credential is
   * configured as well, a 401 stops being unambiguous — it could be this
   * server's own credential that was refused — and the emitter's status for an
   * invalid ticket should be set explicitly.
   */
  absentStatuses?: readonly number[];
  /** How long a validated ticket is reused. Bounds how long a revocation takes. */
  cacheSeconds?: number;
  /** How long a rejection is reused, so a bad ticket is not revalidated per request. */
  negativeCacheSeconds?: number;
  maxCacheEntries?: number;
  requestTimeoutMs?: number;
  /** Every ticket holder is a person unless the host says otherwise. */
  principalKind?: DashboardPrincipalKind;
  fetchImpl?: typeof fetch;
  now?: () => number;
  onReject?: (reason: string) => void;
}

const DEFAULT_ABSENT = [401, 404] as const;
const DEFAULT_CACHE_SECONDS = 60;
const DEFAULT_NEGATIVE_CACHE_SECONDS = 30;
const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TIMEOUT_MS = 5000;

/** Base64 of the UTF-8 bytes. `btoa` alone throws above U+00FF. */
function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * The cache key: a digest, never the ticket.
 *
 * The ticket is a live credential. Keying the table by it would leave every
 * ticket the server has seen readable in a heap dump for the length of the
 * cache interval, which the ticket itself outlives.
 */
async function digest(ticket: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ticket),
  );
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The ticket from the configured header, or null when there is none. */
function ticketFrom(
  request: Request,
  header: string,
  scheme: string | undefined,
): string | null {
  const raw = request.headers.get(header)?.trim();
  if (raw === undefined || raw.length === 0) return null;
  if (scheme === undefined) return raw;

  // Split on whitespace rather than matched with a pattern: a pattern applied
  // to an attacker-controlled header produced a high-severity ReDoS finding
  // here before.
  const parts = raw.split(/\s+/);
  if (parts.length !== 2) return null;
  const [presented, ticket] = parts as [string, string];
  return presented.toLowerCase() === scheme.toLowerCase() && ticket.length > 0
    ? ticket
    : null;
}

export function createTicketIdentityResolver(
  options: TicketIdentityOptions,
): IdentityResolver<Request> {
  const problem = secureUrlProblem(
    fillTemplate(options.url, { ticket: "t", ticketBase64: "t" }),
    "The ticket validation URL",
  );
  if (problem !== null) throw new EndpointError(problem);
  if (options.header.trim().length === 0) {
    throw new EndpointError(
      "A ticket resolver needs the name of the header callers present the " +
        "ticket in",
    );
  }

  const method = options.method ?? "GET";
  const absentStatuses = options.absentStatuses ?? DEFAULT_ABSENT;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const kind = options.principalKind ?? "user";

  const reject = (reason: string): null => {
    options.onReject?.(reason);
    return null;
  };

  function identityFrom(body: unknown): DashboardIdentity | null {
    const userId = readIdentifierAt(body, options.claims.userId);
    if (userId === null) {
      return reject(
        `the ticket was accepted but the response carries no usable ` +
          `"${options.claims.userId}", which is where this server reads the ` +
          "user id from",
      );
    }

    let tenantId: string;
    if (options.tenant.kind === "fixed") {
      tenantId = options.tenant.tenantId;
    } else {
      const fromResponse = readIdentifierAt(body, options.tenant.path);
      if (fromResponse === null) {
        return reject(
          "the ticket was accepted but the response carries no usable " +
            `"${options.tenant.path}", which is where this server reads the ` +
            "tenant from",
        );
      }
      tenantId = fromResponse;
    }

    const groups =
      options.claims.groups === undefined
        ? []
        : readGroupsAt(body, options.claims.groups);
    const displayName =
      options.claims.displayName === undefined
        ? null
        : readIdentifierAt(body, options.claims.displayName);

    return {
      userId,
      tenantId,
      kind,
      // An upper bound, not a grant: the scope authority and the permission
      // assignments decide what this principal may do on a dashboard.
      capabilities: { ...FULL_CAPABILITIES },
      ...(groups.length > 0 ? { groups } : {}),
      ...(displayName === null ? {} : { displayName }),
    };
  }

  const validate = createLookupCache<string, DashboardIdentity>({
    ttlMs: (options.cacheSeconds ?? DEFAULT_CACHE_SECONDS) * 1000,
    negativeTtlMs:
      (options.negativeCacheSeconds ?? DEFAULT_NEGATIVE_CACHE_SECONDS) * 1000,
    maxEntries: options.maxCacheEntries ?? DEFAULT_MAX_ENTRIES,
    ...(options.now ? { now: options.now } : {}),
    load: async (ticket) => {
      const url = new URL(
        fillTemplate(options.url, {
          ticket,
          ticketBase64: base64(ticket),
        }),
      );
      if (options.present.kind === "query") {
        url.searchParams.set(options.present.name, ticket);
      }

      const outcome = await fetchJson({
        url,
        method,
        headers: {
          ...(options.headers ?? {}),
          ...(options.present.kind === "header"
            ? {
                [options.present.name]: fillHeaderTemplate(
                  options.present.value,
                  { ticket, ticketBase64: base64(ticket) },
                ),
              }
            : {}),
        },
        ...(options.present.kind === "body" ? { body: { ticket } } : {}),
        timeoutMs,
        absentStatuses,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });

      if (outcome.kind === "absent") {
        return reject("the ticket emitter did not accept the presented ticket");
      }
      return identityFrom(outcome.body);
    },
  });

  return {
    async resolve(request: Request): Promise<DashboardIdentity | null> {
      const ticket = ticketFrom(request, options.header, options.scheme);
      // No credential is an anonymous request, not a refusal. Reporting it
      // would log every unauthenticated request.
      if (ticket === null) return null;
      return validate(await digest(ticket), ticket);
    },
  };
}
