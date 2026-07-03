import { NextResponse } from "next/server";
import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { logger } from "@/lib/logger";

const MIOT_HARNESS_HOST = process.env.MIOT_HARNESS_URL ?? "";
// Org slug on the harness proxy. May differ from MIOT_DEFAULT_ORG_ID when the
// harness and resource API are hosted on separate deployments with different
// org slugs for the same tenant. Falls back to dynamic scope resolution.
const MIOT_HARNESS_ORG = process.env.MIOT_HARNESS_ORG ?? "";

/** ms before we abort a run that hasn't completed */
const HARNESS_SEARCH_TIMEOUT_MS = 12_000;

export type HarnessBlock =
  | { type: "markdown"; value: string }
  | { type: "url"; value: { url: string; name: string } };

export interface HarnessSearchResult {
  id: string;
  label: string;
  sublabel?: string;
  blocks: HarnessBlock[];
}

function isValidBlock(item: unknown): item is HarnessBlock {
  if (!item || typeof item !== "object") return false;
  const b = item as Record<string, unknown>;
  if (b.type === "markdown") return typeof b.value === "string";
  if (b.type === "url") {
    if (!b.value || typeof b.value !== "object") return false;
    const v = b.value as Record<string, unknown>;
    return (
      typeof v.url === "string" &&
      /^https?:\/\//i.test(v.url) &&
      typeof v.name === "string"
    );
  }
  return false;
}

function parseAnswerBlocks(answer: string): HarnessBlock[] {
  try {
    const parsed: unknown = JSON.parse(answer);
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidBlock);
    }
  } catch {
    // fall through to plain-text fallback
  }
  return [{ type: "markdown", value: answer }];
}

function buildLabel(blocks: HarnessBlock[]): string {
  const first = blocks.find((b): b is Extract<HarnessBlock, { type: "markdown" }> => b.type === "markdown");
  const raw = first?.value ?? "";
  const plain = raw.replace(/[*_`#[\]]/g, "").trim();
  return plain.slice(0, 120) + (plain.length > 120 ? "…" : "");
}

export async function POST(request: Request) {
  if (!MIOT_HARNESS_HOST) {
    return NextResponse.json({ results: [] });
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body: { query?: string } = await request.json().catch(() => ({}));
  const query = body.query?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });

  // Use MIOT_HARNESS_ORG if set (harness slug may differ from the resource API
  // slug when the two services run in separate deployments). Fall back to
  // resolveTenantScope() only when no override is configured.
  let orgSlug = MIOT_HARNESS_ORG;
  if (!orgSlug) {
    const scopeResult = await resolveTenantScope();
    if (!scopeResult.resolved) return scopeResult.response;
    orgSlug = scopeResult.scope.activeOrg.slug;
  }

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

    const blocks = parseAnswerBlocks(answer);
    const result: HarnessSearchResult = {
      id: `harness:${run_id}`,
      label: buildLabel(blocks),
      blocks,
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
