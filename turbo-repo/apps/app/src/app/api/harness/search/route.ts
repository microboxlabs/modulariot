import { NextResponse } from "next/server";
import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import { toSearchResult } from "./search-blocks";

const MIOT_HARNESS_HOST = process.env.MIOT_HARNESS_URL ?? "";

/** ms before we abort a run that hasn't completed — entity lookups on the
 * agentic path (planner → datasource tools → verify gate) need headroom.
 * Multi-turn agentic runs (planner + ~5 primitive calls + verify + synth)
 * measure ~35-45s against the acs connection, so 30s aborted real answers. */
const HARNESS_SEARCH_TIMEOUT_MS = 90_000;

export async function POST(request: Request) {
  if (!MIOT_HARNESS_HOST) {
    return NextResponse.json({ results: [] });
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body: { query?: string } = await request.json().catch(() => ({}));
  const query = body.query?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });

  // The org (and therefore the tenant) is always resolved by the backend from
  // the authenticated session — never pinned by env. resolveTenantScope() reads
  // the active org via Quarkus /me/scopes; the harness proxy at
  // /api/v1/orgs/{slug}/harness injects the tenant client id from membership.
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  const orgSlug = scopeResult.scope.activeOrg.slug;

  const harnessUrl = `${MIOT_HARNESS_HOST}/api/v1/orgs/${orgSlug}/harness`;

  // The harness accepts the Auth0 id_token (rawJWT) as the bearer token.
  // The opaque access_token (no AUTH_AUTH0_AUDIENCE) is NOT a JWT and is rejected.
  const token =
    authResult.session.user?.rawJWT ??
    authResult.session.user?.ticket ??
    undefined;

  const client = createMiotHarnessClient({
    baseUrl: harnessUrl,
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
        skill_id: "miot-search",
        answer_format: "json",
        mode: "auto",
        // tenant_id is ignored by the proxy — it injects X-Miot-Tenant-Client-Id from org membership
        ...(authResult.session.user?.email && { user_id: authResult.session.user.email }),
      },
      { signal: controller.signal },
    );

    // Drain the stream until the terminal event — answer text is NOT carried
    // in stream events, only in the final run record from runs.get().
    for await (const event of client.runs.stream(run_id, { signal: controller.signal })) {
      if (TERMINAL_EVENT_TYPES.has(event.type)) break;
    }

    // Fetch the completed run record which contains the full answer text.
    const record = await client.runs.get(run_id, { signal: controller.signal });
    const answer = record.answer;

    if (!answer) return NextResponse.json({ results: [] });

    return NextResponse.json({ results: [toSearchResult(run_id, answer)] });
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
