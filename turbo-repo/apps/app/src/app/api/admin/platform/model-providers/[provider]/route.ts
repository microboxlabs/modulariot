import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * PUT /api/admin/platform/model-providers/[provider] — create or replace one
 * DELETE /api/admin/platform/model-providers/[provider] — remove it and its key
 *
 * Proxies to Quarkus `/api/v1/platform/model-providers/{provider}`, which
 * requires platform ownership.
 */
interface RouteParams {
  params: Promise<{ provider: string }>;
}

function providerPath(provider: string): string {
  return `/api/v1/platform/model-providers/${encodeURIComponent(provider)}`;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { provider } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(providerPath(provider), { method: "PUT", body });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { provider } = await params;
  return forwardToQuarkus(providerPath(provider), { method: "DELETE" });
}
