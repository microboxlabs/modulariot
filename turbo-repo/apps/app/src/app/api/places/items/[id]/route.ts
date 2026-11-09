import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { placeRequestSchema } from "@/features/places/data/saved-places";

/**
 * PUT    /app/api/places/items/[id] — replaces a geofence (with all its
 *        inner geofences) or route as its next version: the body carries the
 *        edit's `version` (MAJOR, MINOR or PATCH and a description)
 *
 * A delete goes by External ID, on `/app/api/places/items?code=`.
 *
 * Proxies to miot-places `/api/v1/orgs/{org}/places/items/{id}`, which checks
 * `controltower:places.edit`.
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

async function itemPath(params: RouteParams["params"]) {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const { id } = await params;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return `/api/v1/orgs/${org}/places/items/${encodeURIComponent(id)}`;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const path = await itemPath(params);
  if (path instanceof NextResponse) return path;
  const body = placeRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!body.success) {
    return NextResponse.json({ error: "Invalid place" }, { status: 400 });
  }
  return forwardToQuarkus(path, { method: "PUT", body: body.data });
}
