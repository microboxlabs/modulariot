import { NextResponse, type NextRequest } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/admin/orgs/[orgId]/geocoding-plan?month=YYYY-MM — the geocoding plan,
 * the organization's quota and a month's usage.
 *
 * Proxies to `/api/v1/orgs/{orgId}/geocoding-plan` on the modulith that runs
 * trips, where the usage is recorded. The modulith allows an owner of the
 * organization or a platform owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const month = request.nextUrl.searchParams.get("month");
  if (month !== null && !MONTH.test(month)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400 }
    );
  }
  const query = month ? `?month=${month}` : "";
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/geocoding-plan${query}`,
    { sessionOnly: true }
  );
}

/**
 * PUT /api/admin/orgs/[orgId]/geocoding-plan — the organization's quota and
 * what happens when it is used. The modulith allows only a platform owner.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/geocoding-plan`,
    { method: "PUT", body, sessionOnly: true }
  );
}
