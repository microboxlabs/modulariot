import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/harness-plan — the seat plan
 * PUT /api/admin/platform/harness-plan — change seat price, tokens per seat
 * and the yearly discount
 *
 * Proxies to Quarkus `/api/v1/platform/harness-plan`, which requires platform
 * ownership.
 */
export async function GET() {
  return forwardToQuarkus("/api/v1/platform/harness-plan");
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus("/api/v1/platform/harness-plan", {
    method: "PUT",
    body,
  });
}
