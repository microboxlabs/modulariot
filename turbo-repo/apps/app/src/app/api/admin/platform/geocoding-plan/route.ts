import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * GET / PUT /api/admin/platform/geocoding-plan — the geocoding plan: prices,
 * the default monthly quota, the alert share and whether quotas are applied.
 *
 * Proxies to `/api/v1/platform/geocoding-plan` on the modulith that runs trips.
 * The modulith requires platform ownership.
 */
const PATH = "/api/v1/platform/geocoding-plan";

export async function GET() {
  return forwardToStreamhubModulith(PATH, { sessionOnly: true });
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
    sessionOnly: true,
  });
}
