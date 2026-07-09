import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { recordEpisode, type EpisodeBody } from "./record-episode";

/**
 * Relays a client-observed interaction signal (a clicked spotlight result, a
 * rephrase) to the modulith's episode store for the semantic-layer learning
 * loop. Same session-auth + org-scope chain as the search routes; the browser
 * has no user token for the modulith, so this thin route forwards it. Best
 * effort — returns 204 on success and never surfaces a store failure to the UI.
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const body = (await request.json().catch(() => null)) as Partial<EpisodeBody> | null;
  if (!body || (body.surface !== "spotlight" && body.surface !== "cli")) {
    return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  }

  const token =
    authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? undefined;

  await recordEpisode({
    orgSlug: scopeResult.scope.activeOrg.slug,
    token,
    body: {
      surface: body.surface,
      ...(typeof body.runId === "string" && { runId: body.runId }),
      ...(typeof body.signal === "string" && { signal: body.signal }),
      ...(body.payload && typeof body.payload === "object" && { payload: body.payload }),
    },
  });

  return new NextResponse(null, { status: 204 });
}
