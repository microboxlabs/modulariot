import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET / PUT / DELETE /api/admin/platform/vehicle-images — the platform vehicle image provider.
 * Proxies to Quarkus `/api/v1/platform/vehicle-images`, which requires platform ownership.
 */
const PATH = "/api/v1/platform/vehicle-images";

export async function GET() {
  return forwardToQuarkus(PATH);
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(PATH, { method: "PUT", body });
}

export async function DELETE() {
  return forwardToQuarkus(PATH, { method: "DELETE" });
}
