import { NextResponse, type NextRequest } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/** PUT — an organization's monthly minutes ({ monthlyMinutes }, null uses the plan's). Platform owner only. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantCode: string }> }
) {
  const { tenantCode } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToStreamhubModulith(
    `/api/v1/platform/telephony-plan/organizations/${encodeURIComponent(tenantCode)}`,
    { method: "PUT", body }
  );
}
