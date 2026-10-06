import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * PUT /api/admin/platform/orgs/[slug]/roles/[roleCode] — replace who holds an
 * organization role
 *
 * Proxies to Quarkus `/api/v1/platform/orgs/{slug}/roles/{roleCode}`, which
 * requires platform ownership. A platform owner uses it to name the first
 * owner of an organization nobody belongs to yet.
 */
interface RouteParams {
  params: Promise<{ slug: string; roleCode: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { slug, roleCode } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/platform/orgs/${encodeURIComponent(slug)}/roles/${encodeURIComponent(roleCode)}`,
    { method: "PUT", body }
  );
}
