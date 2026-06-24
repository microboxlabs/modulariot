import { NextResponse } from "next/server";
import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { logger } from "@/lib/logger";

const MIOT_HARNESS_HOST = process.env.MIOT_HARNESS_URL ?? "";
const MIOT_DEFAULT_ORG_ID = process.env.MIOT_DEFAULT_ORG_ID ?? "";
// baseUrl must include the org-scoped proxy path: /api/v1/orgs/{slug}/harness
const MIOT_HARNESS_URL = MIOT_HARNESS_HOST && MIOT_DEFAULT_ORG_ID
  ? `${MIOT_HARNESS_HOST}/api/v1/orgs/${MIOT_DEFAULT_ORG_ID}/harness`
  : MIOT_HARNESS_HOST;

/** ms before we abort a run that hasn't completed */
const HARNESS_SEARCH_TIMEOUT_MS = 12_000;

export interface HarnessSearchResult {
  id: string;
  label: string;
  sublabel?: string;
  fullAnswer: string;
}

export async function POST(request: Request) {
  if (!MIOT_HARNESS_URL) {
    return NextResponse.json({ results: [] });
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body: { query?: string } = await request.json().catch(() => ({}));
  const query = body.query?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });

  // Prefer Auth0 access_token (API audience) over id_token. Credentials users only have rawJWT.
  const token =
    authResult.session.user?.accessToken ??
    authResult.session.user?.rawJWT ??
    authResult.session.user?.ticket ??
    undefined;

  logger.info({ hasToken: !!token, hasAccessToken: !!authResult.session.user?.accessToken, query }, "[harness/search] starting run");

  const client = createMiotHarnessClient({
    baseUrl: MIOT_HARNESS_URL,
    token,
    // Mirror the X-Dev-User-Email header that quarkus-proxy sends on all requests
    headers: authResult.session.user?.email
      ? { "X-Dev-User-Email": authResult.session.user.email }
      : {},
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HARNESS_SEARCH_TIMEOUT_MS);

  try {
    const { run_id } = await client.runs.create(
      {
        message: query,
        mode: "auto",
        // tenant_id is ignored by the proxy — it injects X-Miot-Tenant-Client-Id from org membership
        ...(authResult.session.user?.email && { user_id: authResult.session.user.email }),
      },
      { signal: controller.signal },
    );

    logger.info({ run_id }, "[harness/search] run created, streaming events");

    let answer: string | null = null;

    for await (const event of client.runs.stream(run_id, { signal: controller.signal })) {
      logger.info({ type: event.type, hasMessage: !!event.message, dataKeys: Object.keys(event.data ?? {}) }, "[harness/search] event");

      if (event.type === "answer.completed") {
        // The answer text may live in event.message or event.data.text
        const text =
          (event.message && event.message.trim() ? event.message : null) ??
          (event.data?.text as string | undefined) ??
          null;
        if (text) answer = text;
      }
      if (TERMINAL_EVENT_TYPES.has(event.type)) break;
    }

    logger.info({ run_id, hasAnswer: !!answer }, "[harness/search] stream done");

    // Fallback: fetch the full record if the stream didn't carry answer.completed
    if (!answer) {
      try {
        const record = await client.runs.get(run_id, { signal: controller.signal });
        answer = record.answer;
        logger.info({ run_id, hasAnswer: !!answer }, "[harness/search] fallback record fetched");
      } catch (e) {
        logger.warn({ e }, "[harness/search] fallback runs.get failed");
      }
    }

    if (!answer) return NextResponse.json({ results: [] });

    const firstLine = answer.split("\n").find((l) => l.trim()) ?? answer;
    const label = firstLine.slice(0, 120) + (firstLine.length > 120 ? "…" : "");

    const result: HarnessSearchResult = {
      id: `harness:${run_id}`,
      label,
      fullAnswer: answer,
    };

    return NextResponse.json({ results: [result] });
  } catch (err: unknown) {
    const isAbort = (err as { name?: string }).name === "AbortError";
    if (!isAbort) {
      logger.error({ err }, "[harness/search] unexpected error");
    }
    return NextResponse.json({ results: [] });
  } finally {
    clearTimeout(timeout);
  }
}
