import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * The organization's GEOCODING connection and its credential, on the modulith
 * that runs trips: the geocoder reads the connection from that modulith's
 * database, which may not be the coordinator one.
 *
 * GET/POST  .../geocoding/integrations/connections
 * PATCH     .../geocoding/integrations/connections/{id}
 * POST      .../geocoding/integrations/credential-profiles
 * DELETE    .../geocoding/integrations/credential-profiles/{id}
 *
 * Owner only, as the coordinator connection routes.
 */
type Params = { params: Promise<{ orgId: string; path: string[] }> };

const ID = /^[A-Za-z0-9_-]+$/;

const ALLOWED: Record<string, readonly string[]> = {
  connections: ["GET", "POST"],
  "connections/:id": ["PATCH"],
  "credential-profiles": ["POST"],
  "credential-profiles/:id": ["DELETE"],
};

/** `connections`, `connections/:id`…, or null when the path is not one of them. */
function routeOf(path: readonly string[]): string | null {
  const [resource, id, ...rest] = path;
  if (rest.length > 0 || resource === undefined) return null;
  if (id === undefined) return resource;
  return ID.test(id) ? `${resource}/:id` : null;
}

async function forward(request: Request, { params }: Params, method: string) {
  const { orgId, path } = await params;
  const route = routeOf(path);
  if (route === null || !ALLOWED[route]?.includes(method)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;

  let body: unknown;
  if (method === "POST" || method === "PATCH") {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  const suffix = path.map((s) => encodeURIComponent(s)).join("/");
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/${suffix}`,
    { method, body, sessionOnly: true }
  );
}

export const GET = (request: Request, ctx: Params) =>
  forward(request, ctx, "GET");
export const POST = (request: Request, ctx: Params) =>
  forward(request, ctx, "POST");
export const PATCH = (request: Request, ctx: Params) =>
  forward(request, ctx, "PATCH");
export const DELETE = (request: Request, ctx: Params) =>
  forward(request, ctx, "DELETE");
