import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * GET / PUT / DELETE /api/admin/platform/geocoding-provider — the geocoding
 * provider the platform contracts for every organization.
 *
 * Proxies to `/api/v1/platform/geocoding-provider` on the modulith that runs
 * trips, where the geocoder reads the connection. The modulith requires
 * platform ownership, so the session is always forwarded.
 */
const PATH = "/api/v1/platform/geocoding-provider";

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

export async function DELETE() {
  return forwardToStreamhubModulith(PATH, {
    method: "DELETE",
    sessionOnly: true,
  });
}
