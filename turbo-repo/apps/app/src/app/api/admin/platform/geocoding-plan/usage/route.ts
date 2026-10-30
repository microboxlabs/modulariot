import { NextResponse, type NextRequest } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/admin/platform/geocoding-plan/usage?month=YYYY-MM — every
 * organization with a geocoding subscription or usage in the month.
 *
 * Proxies to `/api/v1/platform/geocoding-plan/usage`, which requires platform
 * ownership.
 */
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (month !== null && !MONTH.test(month)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400 }
    );
  }
  const query = month ? `?month=${month}` : "";
  return forwardToStreamhubModulith(
    `/api/v1/platform/geocoding-plan/usage${query}`,
    { sessionOnly: true }
  );
}
