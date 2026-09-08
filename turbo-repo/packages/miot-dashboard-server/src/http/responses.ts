/**
 * The only place this package turns a value into an HTTP response.
 *
 * Every adapter and the standalone server go through here, so the envelope in
 * `contract/openapi.yaml` is produced once rather than restated per route.
 */

import { toErrorEnvelope } from "../access/errors";

/**
 * `no-store` is not boilerplate here, it is the tenancy guarantee reaching the
 * cache layer.
 *
 * Every path in this API serves a different body depending on the credential
 * that asked — `/scopes/ops/dashboards/fleet` is a different dashboard for
 * each tenant, by design. Without an explicit policy, a shared cache or a
 * browser's back/forward store is free to hand one identity's response to
 * another, which would defeat the isolation the rest of the package spends its
 * effort on. `Vary: Authorization` would be weaker: the credential can arrive
 * in several headers, and a cache that does not know them all still guesses.
 */
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS },
  });
}

export function noContentResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Serialize a thrown value.
 *
 * `toErrorEnvelope` reduces anything that is not a `DashboardServerError` to a
 * generic 500 and drops its message, which is the rule that keeps a connection
 * string or a token from reaching a client through an unhandled upstream
 * failure. The status always matches the envelope, so the two can never drift.
 */
export function errorResponse(error: unknown): Response {
  const envelope = toErrorEnvelope(error);
  return jsonResponse(envelope, envelope.status);
}
