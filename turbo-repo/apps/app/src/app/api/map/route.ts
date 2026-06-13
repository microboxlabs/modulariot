import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { mapLogger } from "@/lib/logger";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_map_positions`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

/**
 * The upstream gateway (APISIX) rate-limits this RPC by concurrency and rejects
 * bursts with `429 "Spike arrest: too many concurrent requests"`. A 429 is
 * backpressure, not a server fault, so we must not surface it as a 500.
 *
 * Three things keep a transient spike from breaking the map:
 *   1. Single-flight: simultaneous requests (map page + sidebar count + dashlet
 *      + focus/reconnect revalidations across tabs) share ONE upstream call,
 *      so the FE stops generating the concurrency the limiter is rejecting.
 *   2. Short TTL cache: identical bursts within the window are served without
 *      touching the upstream at all.
 *   3. Bounded backoff retry on 429/5xx, then fall back to the last-known
 *      payload (or a retryable 503) instead of a hard 500.
 */
const CACHE_TTL_MS = 5_000;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 250;

let cachedPayload: { data: unknown; ts: number } | null = null;
let inFlight: Promise<unknown> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/**
 * Fetch the last-known positions, retrying transient gateway backpressure with
 * exponential backoff (honoring `Retry-After` when present). Throws a tagged
 * error carrying the final upstream status on persistent failure.
 */
async function fetchPositions(): Promise<unknown> {
  const token = await authToken.getToken();
  const url = `${SYMPTOMS_API_URL}?p_is_dev=true`;

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const json: unknown = await response.json();
      // Upstream wraps the rows as { data: [...] }; unwrap to the array.
      if (json && typeof json === "object" && "data" in json) {
        return json.data;
      }
      // Malformed 200 (missing `data`): treat as an upstream fault instead of
      // caching `undefined` as a successful, empty map.
      lastStatus = 502;
      lastBody = "unexpected upstream payload shape";
      break;
    }

    lastStatus = response.status;
    lastBody = await response.text();

    if (!isRetryableStatus(response.status) || attempt === MAX_RETRIES) {
      break;
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1_000
        : BASE_BACKOFF_MS * 2 ** attempt;
    await sleep(backoff);
  }

  // Log the full upstream detail server-side only; never echo the raw body to
  // the client (it can carry internal gateway/db error text).
  mapLogger.error(
    { responseUrl: url, status: lastStatus, body: lastBody },
    "Map upstream request failed"
  );
  const error = new Error(
    `Map upstream request failed with status ${lastStatus}`
  ) as Error & { status?: number };
  error.status = lastStatus;
  throw error;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Serve a recent payload to collapse request bursts before they reach the
  // concurrency-limited gateway.
  if (cachedPayload && Date.now() - cachedPayload.ts < CACHE_TTL_MS) {
    return NextResponse.json(cachedPayload.data);
  }

  try {
    // Single-flight: concurrent callers await the same upstream request.
    inFlight ??= fetchPositions().finally(() => {
      inFlight = null;
    });
    const data = await inFlight;
    cachedPayload = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const retryable = isRetryableStatus(status);

    // A transient gateway spike should not blank the map: prefer the last-known
    // positions when we have them, even if slightly stale. Only for *retryable*
    // faults — a non-retryable error (e.g. a 4xx contract/auth break) must
    // surface, not hide behind stale data indefinitely.
    if (retryable && cachedPayload) {
      return NextResponse.json(cachedPayload.data, {
        headers: { "x-map-stale": "1" },
      });
    }

    // Return a *retryable* status for backpressure so the client backs off and
    // retries instead of treating it as a hard 500. Keep the client message
    // generic; the upstream detail is logged server-side only.
    return NextResponse.json(
      {
        error: "Failed to fetch map positions",
        errorMessage: "Map positions are temporarily unavailable",
      },
      {
        status: retryable ? 503 : 500,
        headers: retryable ? { "Retry-After": "5" } : undefined,
      }
    );
  }
}
