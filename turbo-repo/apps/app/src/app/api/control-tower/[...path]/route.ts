import { NextRequest, NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * Proxy to the modulith Control Tower API
 * (`/api/v1/orgs/{org}/control-tower/...`). The organization is the caller's
 * active one, resolved here on the server — the browser never names it — and
 * the user's session token is forwarded so the modulith checks membership and
 * records the actor.
 */
type Params = { params: Promise<{ path: string[] }> };

const SEGMENT = /^[A-Za-z0-9_-]+$/;

async function forward(req: NextRequest, { params }: Params, method: string) {
  const { path } = await params;
  if (!path?.length || !path.every((s) => SEGMENT.test(s))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;

  let body: unknown;
  if (method !== "GET" && method !== "DELETE") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    } else {
      body = {};
    }
  }

  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return forwardToQuarkus(
    `/api/v1/orgs/${org}/control-tower/${path.join("/")}${req.nextUrl.search}`,
    { method, body }
  );
}

export const GET = (req: NextRequest, ctx: Params) => forward(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Params) => forward(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: Params) => forward(req, ctx, "PUT");
export const PATCH = (req: NextRequest, ctx: Params) => forward(req, ctx, "PATCH");
export const DELETE = (req: NextRequest, ctx: Params) => forward(req, ctx, "DELETE");
