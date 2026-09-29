import { NextRequest, NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * Route handlers that proxy to a modulith API under
 * `/api/v1/orgs/{org}/{resource}/...`. The organization is the caller's active
 * one, resolved here on the server (the browser never names it), and the
 * user's session token is forwarded so the modulith checks membership and
 * records the actor. `allowRoot` lets a request with no path segments reach
 * the resource itself, for APIs that list at their root.
 */
type Params = { params: Promise<{ path?: string[] }> };

const SEGMENT = /^[A-Za-z0-9_-]+$/;

export function orgApiProxy(resource: string, { allowRoot = false }: { allowRoot?: boolean } = {}) {
  async function forward(req: NextRequest, { params }: Params, method: string) {
    const path = (await params).path ?? [];
    if ((!allowRoot && !path.length) || !path.every((s) => SEGMENT.test(s))) {
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
    const suffix = path.length ? `/${path.join("/")}` : "";
    return forwardToQuarkus(`/api/v1/orgs/${org}/${resource}${suffix}${req.nextUrl.search}`, { method, body });
  }

  return {
    GET: (req: NextRequest, ctx: Params) => forward(req, ctx, "GET"),
    POST: (req: NextRequest, ctx: Params) => forward(req, ctx, "POST"),
    PUT: (req: NextRequest, ctx: Params) => forward(req, ctx, "PUT"),
    PATCH: (req: NextRequest, ctx: Params) => forward(req, ctx, "PATCH"),
    DELETE: (req: NextRequest, ctx: Params) => forward(req, ctx, "DELETE"),
  };
}
