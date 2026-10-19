import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET / PUT / DELETE /api/admin/platform/mail — the platform email sender.
 * Proxies to Quarkus `/api/v1/platform/mail`, which requires platform ownership.
 */
const MAIL_PATH = "/api/v1/platform/mail";

export async function GET() {
  return forwardToQuarkus(MAIL_PATH);
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(MAIL_PATH, { method: "PUT", body });
}

export async function DELETE() {
  return forwardToQuarkus(MAIL_PATH, { method: "DELETE" });
}
