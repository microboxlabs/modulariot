/**
 * Calling a host's own service and reading JSON back.
 *
 * Two seams delegate to the host over HTTP: scope membership and ticket
 * validation. Both need the same three things, and getting any of them wrong
 * is a security bug rather than a bug:
 *
 * 1. The URL must be https, so the answer cannot be forged in transit.
 * 2. A redirect is refused rather than followed. Following one moves the
 *    decision to a host nobody configured, and `fetch` will follow https to
 *    http without complaint.
 * 3. "The answer is no" and "the service did not answer" are different
 *    outcomes. Collapsing the second into the first turns an outage into a
 *    refusal of every request, which looks like a working server that has
 *    denied everyone.
 */

import { isLoopbackHost } from "./loopback";

export class EndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndpointError";
  }
}

/**
 * Why `raw` is not usable as an endpoint, or null when it is.
 *
 * Returns the message instead of throwing so each caller raises its own error
 * type: a bad JWKS URL is a `KeySourceError`, a bad membership URL is a
 * `ConfigError`, and the difference decides whether the process starts.
 */
export function secureUrlProblem(raw: string, what: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return `"${raw}" is not a URL`;
  }
  if (url.protocol !== "https:" && !isLoopbackHost(url.hostname)) {
    return (
      `${what} must use https (got "${url.protocol}//"). Anyone able to ` +
      "answer it decides who this server lets in."
    );
  }
  return null;
}

export interface JsonRequest {
  url: URL;
  method: "GET" | "POST";
  headers: Record<string, string>;
  /** Serialized as JSON when present. Ignored by GET. */
  body?: unknown;
  timeoutMs: number;
  /**
   * Statuses meaning "no such thing", as opposed to a failure. 404 is the
   * usual one. 401 and 403 are deliberately NOT in the default: from this
   * server's side they mean our own credential was refused, which is a
   * misconfiguration that must be visible rather than denied silently.
   */
  absentStatuses: readonly number[];
  fetchImpl?: typeof fetch;
}

export type JsonOutcome = { kind: "found"; body: unknown } | { kind: "absent" };

/**
 * One JSON request. Returns `absent` for a configured "no such thing" status
 * and throws `EndpointError` for everything else, including a redirect, a
 * timeout and an unparseable body.
 */
export async function fetchJson(request: JsonRequest): Promise<JsonOutcome> {
  const call = request.fetchImpl ?? fetch;
  const sendsBody = request.method === "POST" && request.body !== undefined;

  let response: Response;
  try {
    response = await call(request.url, {
      method: request.method,
      headers: {
        accept: "application/json",
        ...(sendsBody ? { "content-type": "application/json" } : {}),
        ...request.headers,
      },
      ...(sendsBody ? { body: JSON.stringify(request.body) } : {}),
      // Node returns the real 3xx and a readable Location under "manual",
      // unlike a browser, so this refuses redirects rather than hiding them.
      redirect: "manual",
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch (error) {
    throw new EndpointError(
      `${request.url.origin} did not answer: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (request.absentStatuses.includes(response.status)) {
    return { kind: "absent" };
  }
  if (response.status >= 300 && response.status < 400) {
    throw new EndpointError(
      `${request.url.origin} answered ${response.status} with a redirect. ` +
        "Redirects are not followed here: the destination would decide who " +
        "this server lets in. Configure the final URL instead.",
    );
  }
  if (!response.ok) {
    throw new EndpointError(
      `${request.url.origin} answered ${response.status}`,
    );
  }

  try {
    return { kind: "found", body: await response.json() };
  } catch {
    throw new EndpointError(
      `${request.url.origin} answered ${response.status} with a body that is not JSON`,
    );
  }
}

/**
 * A value from a dotted path, or null.
 *
 * Only own properties are followed, so a path cannot walk into a prototype
 * and read `constructor` off a parsed response.
 */
export function readPath(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return null;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** A path read as an identifier: a non-empty string, or a finite number. */
export function readIdentifierAt(source: unknown, path: string): string | null {
  const value = readPath(source, path);
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** A path read as authority ids: an array, or a comma/space-separated string. */
export function readGroupsAt(source: unknown, path: string): string[] {
  const value = readPath(source, path);
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Fill `{name}` placeholders in a URL, encoding every value.
 *
 * Encoding is what stops a scope id of `../../admin` from addressing a
 * different resource on the host than the one being asked about.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let filled = template;
  for (const [name, value] of Object.entries(values)) {
    filled = filled.split(`{${name}}`).join(encodeURIComponent(value));
  }
  return filled;
}

/**
 * Fill `{name}` placeholders in a header value, without encoding.
 *
 * Separate from `fillTemplate` because the two must not be swapped: a header
 * value has to arrive byte for byte — percent-encoding a base64 credential
 * mangles its `+`, `/` and `=` and the far end rejects it — while a URL
 * segment has to be encoded or it addresses something else.
 *
 * A value containing a carriage return or newline is refused rather than
 * inserted. That is how a credential in a header becomes two headers.
 */
export function fillHeaderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let filled = template;
  for (const [name, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) {
      throw new EndpointError(
        `A line break in the value for "${name}" would split the header it ` +
          "is placed in",
      );
    }
    filled = filled.split(`{${name}}`).join(value);
  }
  return filled;
}
