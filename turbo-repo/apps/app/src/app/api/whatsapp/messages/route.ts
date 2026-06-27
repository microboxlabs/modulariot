import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * POST /api/whatsapp/messages — send an outbound WhatsApp message for the caller's
 * active organization. The active org is resolved server-side (no org id in the URL),
 * then the request is proxied to Quarkus
 * `POST /api/v1/orgs/{org}/whatsapp/messages` (miot-conversational).
 */
export async function POST(request: Request) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(`/api/v1/orgs/${org}/whatsapp/messages`, {
    method: "POST",
    body,
  });
}
