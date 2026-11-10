import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * GET / PUT /api/admin/platform/telephony-plan — the managed telephony plan:
 * prices per minute and per template, default monthly minutes, enforced.
 * Proxies to `/api/v1/platform/telephony-plan`; the modulith requires platform ownership.
 */
const PATH = "/api/v1/platform/telephony-plan";

export async function GET() {
  return forwardToStreamhubModulith(PATH);
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToStreamhubModulith(PATH, {
    method: "PUT",
    body,
  });
}
