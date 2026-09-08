import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET    /api/admin/platform/branding/domains/[domain] — one domain's branding
 * PUT    /api/admin/platform/branding/domains/[domain] — create or replace it
 * DELETE /api/admin/platform/branding/domains/[domain] — revert to the default
 *
 * Proxies to Quarkus `/api/v1/platform/branding/domains/{domain}`, which
 * requires platform ownership and normalizes the domain, validates the logo's
 * type and size and restricts the home URL's scheme. The PUT body carries the
 * logo as a `data:` URL — see `LogoImage`.
 */
interface RouteParams {
  params: Promise<{ domain: string }>;
}

function domainPath(domain: string): string {
  return `/api/v1/platform/branding/domains/${encodeURIComponent(domain)}`;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { domain } = await params;
  return forwardToQuarkus(domainPath(domain));
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { domain } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(domainPath(domain), { method: "PUT", body });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { domain } = await params;
  return forwardToQuarkus(domainPath(domain), { method: "DELETE" });
}
