import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

const suffix = "/permissions/content-review-auto-approval";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  return forwardToQuarkus(`/api/v1/orgs/${encodeURIComponent(orgId)}${suffix}`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}${suffix}`,
    { method: "PUT", body }
  );
}
