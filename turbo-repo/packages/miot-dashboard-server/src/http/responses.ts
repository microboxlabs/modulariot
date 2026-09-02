/**
 * The only place this package turns a value into an HTTP response.
 *
 * Every adapter and the standalone server go through here, so the envelope in
 * `contract/openapi.yaml` is produced once rather than restated per route.
 */

import { toErrorEnvelope } from "../access/errors";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS },
  });
}

export function noContentResponse(): Response {
  return new Response(null, { status: 204 });
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
