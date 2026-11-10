import { NextResponse, type NextRequest } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/admin/platform/telephony-plan/usage?month=YYYY-MM — every
 * organization with managed telephony or its own minutes in the month.
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
    `/api/v1/platform/telephony-plan/usage${query}`
  );
}
