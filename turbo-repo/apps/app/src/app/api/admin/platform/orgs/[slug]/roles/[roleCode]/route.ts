import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { evictAllScopeCaches } from "@/app/api/utils/tenant-scope";

/**
 * GET /api/admin/platform/orgs/[slug]/roles/[roleCode] — who holds an
 * organization role
 * PUT /api/admin/platform/orgs/[slug]/roles/[roleCode] — replace who holds it
 *
 * Proxies to Quarkus `/api/v1/platform/orgs/{slug}/roles/{roleCode}`, which
 * requires platform ownership. A platform owner uses it to name the first
 * owner of an organization nobody belongs to yet.
 */
interface RouteParams {
  params: Promise<{ slug: string; roleCode: string }>;
}

function rolePath(slug: string, roleCode: string): string {
  return `/api/v1/platform/orgs/${encodeURIComponent(slug)}/roles/${encodeURIComponent(roleCode)}`;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug, roleCode } = await params;
  return forwardToQuarkus(rolePath(slug, roleCode));
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { slug, roleCode } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const response = await forwardToQuarkus(rolePath(slug, roleCode), {
    method: "PUT",
    body,
  });
  // A new owner gains the organization: cached scopes would hide it.
  if (response.ok) evictAllScopeCaches();
  return response;
}
