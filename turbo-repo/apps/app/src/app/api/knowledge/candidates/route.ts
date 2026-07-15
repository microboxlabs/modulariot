import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import {
  createCandidate,
  listCandidates,
  type CandidateBody,
} from "./candidates-client";

/**
 * Review-queue + staging API for the semantic-layer learning loop. Same
 * session-auth + org-scope chain as the search/episode routes; the browser has
 * no user token for the modulith, so these thin routes forward it. GET lists
 * candidates by status (default pending); POST stages a new candidate.
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const token =
    authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? undefined;
  const status = new URL(request.url).searchParams.get("status") ?? "pending";

  try {
    const candidates = await listCandidates({
      orgSlug: scopeResult.scope.activeOrg.slug,
      token,
      status,
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    logger.error({ err }, "[knowledge/candidates] list failed");
    return NextResponse.json({ error: "list_failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const body = (await request.json().catch(() => null)) as Partial<CandidateBody> | null;
  if (!body?.connection || !body?.term || !body?.body) {
    return NextResponse.json({ error: "invalid_candidate" }, { status: 400 });
  }

  const token =
    authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? undefined;

  try {
    const candidate = await createCandidate({
      orgSlug: scopeResult.scope.activeOrg.slug,
      token,
      body: {
        connection: body.connection,
        term: body.term,
        body: body.body,
        ...(typeof body.kind === "string" && { kind: body.kind }),
        ...(typeof body.scope === "string" && { scope: body.scope }),
        ...(typeof body.confidence === "number" && { confidence: body.confidence }),
        ...(body.provenance && typeof body.provenance === "object" && {
          provenance: body.provenance,
        }),
      },
    });
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "[knowledge/candidates] create failed");
    return NextResponse.json({ error: "create_failed" }, { status: 502 });
  }
}
