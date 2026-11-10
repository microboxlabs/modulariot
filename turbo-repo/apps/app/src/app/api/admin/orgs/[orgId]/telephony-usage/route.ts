import { NextResponse, type NextRequest } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/admin/orgs/[orgId]/telephony-usage?month=YYYY-MM — the plan, the
 * organization's minutes and a month's managed telephony. Owners of the
 * organization and platform owners.
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
    `/api/v1/orgs/${encodeURIComponent(orgId)}/telephony-usage${query}`
  );
}
