import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { orgPath, pickQuery } from "@/app/api/utils/org-proxy";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * The dashboard server's query authoring routes for the active org:
 * `/query-sources[/{source}/{schema|plans|estimate|preview}[/{plan}]]`.
 */
async function forward(request: Request, context: Context) {
  const tenant = await resolveTenantScope();
  if (!tenant.resolved) return tenant.response;
  const url = new URL(request.url);
  // A tab opened in one organization must not save into another after a switch.
  const expectedOrg = url.searchParams.get("org");
  if (expectedOrg !== null && expectedOrg !== tenant.scope.activeOrg.slug) {
    return NextResponse.json(
      { error: "Active organization changed" },
      { status: 409 }
    );
  }
  const path = (await context.params).path ?? [];
  if (
    path.length > 3 ||
    path.some(
      (part) => !part || part === "." || part === ".." || part.includes("/")
    )
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  let body: unknown;
  if (request.method === "PUT" || request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }
  }
  const running = path[1] === "preview" || path[1] === "schema";
  return forwardToQuarkus(
    orgPath(
      tenant.scope.activeOrg.slug,
      ["query-sources", ...path],
      pickQuery(url.searchParams, {
        projectId: /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/,
        refresh: /^1$/,
      })
    ),
    {
      method: request.method,
      body,
      ifMatch: request.headers.get("if-match") ?? undefined,
      ...(running ? { signal: request.signal, timeoutMs: 30_000 } : {}),
    }
  );
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
